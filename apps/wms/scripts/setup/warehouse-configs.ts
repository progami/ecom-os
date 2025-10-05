#!/usr/bin/env npx tsx

/**
 * Setup script: warehouses + cost rates
 * --------------------------------------------------
 * - Creates default warehouses if missing
 * - Seeds baseline storage / handling cost rates via public APIs
 *
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/warehouse-configs.ts [--skip-clean] [--verbose]
 */

import { SetupClient, type WarehouseSeed } from './api-client'

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

function log(message: string, data?: unknown) {
  console.log(`[setup][warehouses] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

const WAREHOUSE_SEEDS: WarehouseSeed[] = [
  {
    code: 'FMC',
    name: 'FMC Primary Warehouse',
    address: '123 Logistics Way, New Jersey, USA',
  },
  {
    code: 'VGLOBAL',
    name: 'Vglobal Fulfilment Center',
    address: '456 Distribution Blvd, California, USA',
  },
]

const RATE_BLUEPRINT = [
  {
    costName: 'Storage per pallet (monthly)',
    costCategory: 'Storage' as const,
    costValue: 18,
    unitOfMeasure: 'PALLET_MONTH',
  },
  {
    costName: 'Inbound handling per pallet',
    costCategory: 'Accessorial' as const,
    costValue: 8,
    unitOfMeasure: 'PALLET',
  },
]

async function upsertWarehouses(client: SetupClient) {
  const results = [] as Array<{ code: string; id: string }>
  for (const warehouse of WAREHOUSE_SEEDS) {
    const record = await client.upsertWarehouse(warehouse)
    const id = record.id ?? record?.warehouse?.id
    if (!id) {
      throw new Error(`Unable to resolve ID for warehouse ${warehouse.code}`)
    }
    results.push({ code: warehouse.code, id })
    log(`Warehouse ready: ${warehouse.code}`)
  }
  return results
}

async function seedCostRates(client: SetupClient, warehouses: Array<{ code: string; id: string }>) {
  const today = new Date()
  const effectiveDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()

  for (const warehouse of warehouses) {
    for (const rate of RATE_BLUEPRINT) {
      if (!skipClean) {
        await client.retireActiveRates(warehouse.id, rate.costName)
      }

      try {
        await client.createRate({
          warehouseId: warehouse.id,
          costCategory: rate.costCategory,
          costName: rate.costName,
          costValue: rate.costValue,
          unitOfMeasure: rate.unitOfMeasure,
          effectiveDate,
        })
        log(`Rate seeded for ${warehouse.code}: ${rate.costName}`)
      } catch (error) {
        if (error instanceof Error) {
          log(`Skipping rate for ${warehouse.code} (${rate.costName}) - ${error.message}`)
        } else {
          log(`Skipping rate for ${warehouse.code} (${rate.costName}) due to unknown error`)
        }
      }
    }
  }
}

async function main() {
  const client = new SetupClient({ verbose })

  try {
    const warehouses = await upsertWarehouses(client)
    await seedCostRates(client, warehouses)
    log('Warehouse setup complete')
  } catch (error) {
    console.error('[setup][warehouses] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
