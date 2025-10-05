#!/usr/bin/env npx tsx

/**
 * Setup script: warehouses + cost rates
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/warehouse-configs.ts [--skip-clean] [--verbose]
 */

import { SetupClient } from '../../src/lib/setup/setup-client'
import { seedWarehouses } from '../../src/lib/setup/warehouse-configs'

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

const log = (message: string) => console.log(`[setup][warehouses] ${message}`)
const verboseLog = verbose
  ? (message: string, data?: unknown) => {
      log(message)
      if (data !== undefined) {
        console.log(JSON.stringify(data, null, 2))
      }
    }
  : undefined

async function main() {
  const client = new SetupClient({ verbose })

  try {
    const { warehouses } = await seedWarehouses(client, {
      skipClean,
      logger: log,
      verboseLogger: verboseLog,
    })
    verboseLog?.('Warehouse records', warehouses)
    log('Warehouse setup complete')
  } catch (error) {
    console.error('[setup][warehouses] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
