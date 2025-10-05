#!/usr/bin/env npx tsx

/**
 * Setup script: ensure weekly storage cost rates for all warehouses
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/storage-rates.ts [--verbose]
 */

import { SetupClient, SetupClientError } from './api-client'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')

function log(message: string, data?: unknown) {
  console.log(`[setup][storage-rates] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function main() {
  const client = new SetupClient({ verbose })

  try {
    const warehouses = await client.listWarehouses(true)
    if (!warehouses.length) {
      throw new Error('No warehouses found. Run warehouse-configs script first.')
    }

    const effectiveDate = new Date('2024-01-01').toISOString()

    for (const warehouse of warehouses) {
      await client.retireActiveRates(warehouse.id, 'Weekly Storage Fee')

      try {
        await client.createRate({
          warehouseId: warehouse.id,
          costCategory: 'Storage',
          costName: 'Weekly Storage Fee',
          costValue: 0.5,
          unitOfMeasure: 'carton/week',
          effectiveDate,
        })
        log(`Storage rate ensured for ${warehouse.code}`)
      } catch (error) {
        if (error instanceof SetupClientError && error.status === 400) {
          log(`Storage rate already active for ${warehouse.code}, leaving existing rate in place`)
          continue
        }
        throw error
      }
    }

    log('Storage rate setup complete')
  } catch (error) {
    console.error('[setup][storage-rates] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
