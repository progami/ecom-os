#!/usr/bin/env npx tsx

/**
 * Setup script: sample purchase & sales orders
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/purchase-orders.ts [--verbose]
 */

import { SetupClient } from '../../src/lib/setup/setup-client'
import { seedPurchaseOrders } from '../../src/lib/setup/purchase-orders'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')

const log = (message: string) => console.log(`[setup][purchase-orders] ${message}`)
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
    const result = await seedPurchaseOrders(client, {
      logger: log,
      verboseLogger: verboseLog,
    })
    verboseLog?.('Purchase order seed result', result)
    log('Purchase & sales order setup complete')
  } catch (error) {
    console.error('[setup][purchase-orders] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
