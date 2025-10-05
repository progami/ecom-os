#!/usr/bin/env npx tsx

/**
 * Setup script: core product catalogue
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/products.ts [--skip-clean] [--verbose]
 */

import { SetupClient } from '../../src/lib/setup/setup-client'
import { seedProducts } from '../../src/lib/setup/products'

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

const log = (message: string) => console.log(`[setup][products] ${message}`)
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
    await seedProducts(client, {
      skipClean,
      logger: log,
      verboseLogger: verboseLog,
    })
    log('Products setup complete')
  } catch (error) {
    console.error('[setup][products] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
