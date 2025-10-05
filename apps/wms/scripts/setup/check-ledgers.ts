#!/usr/bin/env npx tsx

/**
 * Utility script: print recent storage + cost ledger entries via API
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/check-ledgers.ts [--verbose]
 */

import { SetupClient } from './api-client'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')

function printHeader(title: string) {
  console.log('\n==============================')
  console.log(title)
  console.log('==============================')
}

async function main() {
  const client = new SetupClient({ verbose })

  try {
    printHeader('Storage Ledger (latest 10)')
    const storage = await client.getStorageLedger({ includeCosts: true })
    const entries = Array.isArray(storage?.entries) ? storage.entries : []
    if (!entries.length) {
      console.log('No storage ledger entries found.')
    } else {
      for (const entry of entries) {
        console.log(
          `• ${entry.weekEndingDate?.slice(0, 10)} | ${entry.warehouseCode} | ${entry.skuCode} | closing: ${entry.closingBalance} | cost: ${entry.totalStorageCost ?? '—'}`
        )
      }
    }

    printHeader('Cost Ledger (latest 10)')
    const costLedger = await client.getCostLedger({ limit: 10 })
    const costs = Array.isArray(costLedger?.data) ? costLedger.data : Array.isArray(costLedger) ? costLedger : []
    if (!costs.length) {
      console.log('No cost ledger entries found.')
    } else {
      for (const cost of costs) {
        console.log(
          `• ${cost.transactionDate?.slice(0, 10)} | ${cost.warehouseCode} | ${cost.costName} | ${cost.costCategory} | $${Number(cost.totalCost ?? 0).toFixed(2)}`
        )
      }
    }

    const [orders, transactions] = await Promise.all([
      client.listPurchaseOrders(),
      client.listInventoryTransactions({ limit: 200 }),
    ])

    const orderById = new Map<string, any>()
    for (const order of orders) {
      if (order?.id) {
        orderById.set(order.id, order)
      }
    }

    printHeader('Inventory Transactions (latest 20)')
    if (!transactions.length) {
      console.log('No inventory transactions recorded.')
    } else {
      const recentTransactions = transactions.slice(0, 20)
      for (const tx of recentTransactions) {
        const order = tx.purchaseOrderId ? orderById.get(tx.purchaseOrderId) : undefined
        const orderNumber = order?.orderNumber ?? '—'
        const qtyIn = Number(tx.cartonsIn || 0)
        const qtyOut = Number(tx.cartonsOut || 0)
        const net = qtyIn > 0 ? `+${qtyIn}` : qtyOut > 0 ? `-${qtyOut}` : '0'
        const transactionDate = typeof tx.transactionDate === 'string'
          ? tx.transactionDate.slice(0, 10)
          : new Date(tx.transactionDate).toISOString().slice(0, 10)

        console.log(
          `• ${transactionDate} | ${tx.warehouseCode ?? '—'} | ${tx.skuCode ?? '—'} | ${tx.transactionType ?? '—'} ${net} | batch ${tx.batchLot ?? '—'} | PO ${orderNumber}`
        )
      }
      if (transactions.length > recentTransactions.length) {
        console.log(`(${transactions.length - recentTransactions.length} additional transaction(s) fetched but not displayed)`)
      }
    }

    const coveredOrderIds = new Set<string>()
    for (const tx of transactions) {
      if (typeof tx.purchaseOrderId === 'string' && tx.purchaseOrderId.length > 0) {
        coveredOrderIds.add(tx.purchaseOrderId)
      }
    }

    const monitoredStatuses = new Set(['WAREHOUSE', 'CLOSED'])
    const missingOrders = orders.filter((order) =>
      monitoredStatuses.has(order?.status) && !coveredOrderIds.has(order.id)
    )

    printHeader('Orders Missing Inventory Ledger Coverage')
    if (!missingOrders.length) {
      console.log('All warehouse or closed purchase orders have matching inventory transactions.')
    } else {
      for (const order of missingOrders.slice(0, 20)) {
        const expected = typeof order.expectedDate === 'string'
          ? order.expectedDate.slice(0, 10)
          : order.expectedDate
            ? new Date(order.expectedDate).toISOString().slice(0, 10)
            : '—'
        console.log(
          `• ${order.orderNumber} | ${order.warehouseCode} | status ${order.status} | expected ${expected} | counterparty ${order.counterpartyName ?? '—'}`
        )
      }
      if (missingOrders.length > 20) {
        console.log(`(${missingOrders.length - 20} additional order(s) missing coverage)`)
      }
    }

    console.log('\nLedger snapshot complete.')
  } catch (error) {
    console.error('[setup][check-ledgers] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
