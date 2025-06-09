import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/wms/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { InventoryClient } from './client-page'

export default async function AdminInventoryPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login')
  }

  // Fetch real inventory data
  const inventoryBalances = await prisma.inventoryBalance.findMany({
    include: {
      warehouse: true,
      sku: true,
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
    ],
    // Show all inventory balances
  })

  const totalSkus = await prisma.sku.count()
  const totalCartons = await prisma.inventoryBalance.aggregate({
    _sum: { currentCartons: true }
  })
  const totalPallets = await prisma.inventoryBalance.aggregate({
    _sum: { currentPallets: true }
  })
  const lowStockItems = await prisma.inventoryBalance.count({
    where: { currentCartons: { lt: 10 } }
  })

  // Get recent transactions
  const recentTransactions = await prisma.inventoryTransaction.findMany({
    include: {
      warehouse: true,
      sku: true,
      createdBy: true,
    },
    orderBy: { transactionDate: 'desc' },
    take: 20,
  })

  // Prepare data for client component
  const inventoryData = inventoryBalances.map(balance => ({
    id: balance.id,
    warehouse: {
      id: balance.warehouseId,
      name: balance.warehouse.name,
    },
    sku: {
      id: balance.skuId,
      skuCode: balance.sku.skuCode,
      description: balance.sku.description,
    },
    batchLot: balance.batchLot,
    currentCartons: balance.currentCartons,
    currentPallets: balance.currentPallets,
    currentUnits: balance.currentUnits,
    lastTransactionDate: balance.lastTransactionDate,
  }))

  const transactionData = recentTransactions.map(tx => ({
    id: tx.id,
    transactionDate: tx.transactionDate,
    transactionType: tx.transactionType,
    warehouse: {
      id: tx.warehouseId,
      name: tx.warehouse.name,
    },
    sku: {
      id: tx.skuId,
      skuCode: tx.sku.skuCode,
    },
    referenceId: tx.referenceId,
    cartonsIn: tx.cartonsIn,
    cartonsOut: tx.cartonsOut,
    createdBy: {
      id: tx.createdBy.id,
      fullName: tx.createdBy.fullName,
    },
  }))

  return (
    <DashboardLayout>
      <InventoryClient
        inventoryBalances={inventoryData}
        totalSkus={totalSkus}
        totalCartons={totalCartons._sum.currentCartons || 0}
        totalPallets={totalPallets._sum.currentPallets || 0}
        lowStockItems={lowStockItems}
        recentTransactions={transactionData}
      />
    </DashboardLayout>
  )
}