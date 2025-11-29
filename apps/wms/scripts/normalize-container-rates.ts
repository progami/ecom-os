#!/usr/bin/env tsx

/**
 * Normalizes inbound container handling rates for the dev schema. This script is
 * intentionally blocked from running against production-like database URLs unless
 * ALLOW_NON_DEV=true is supplied.
 */

import { prisma } from '../src/lib/prisma'
import { CostCategory } from '@ecom-os/prisma-wms'

function assertDevSchema() {
  const dbUrl = process.env.DATABASE_URL ?? ''
  const allowNonDev = process.env.ALLOW_NON_DEV === 'true'
  const looksLikeDev = dbUrl.length === 0 || /localhost|127\.0\.0\.1|_dev|dev_|-dev/i.test(dbUrl)

  if (!looksLikeDev && !allowNonDev) {
    console.error('❌ This script is restricted to the dev schema. Set ALLOW_NON_DEV=true to override (not recommended).')
    console.error('   DATABASE_URL=', dbUrl || '<not set>')
    process.exit(1)
  }
}

async function normalizeContainerRates() {
  assertDevSchema()

  console.log('🔧 Normalizing container cost rates (dev schema only)...')

  const supportedUnits = ['per_container', 'per_carton', 'per_sku', 'per_pallet', 'per_pallet_day'] as const
  const defaultUnit = 'per_container' as const

  const containerRates = await prisma.costRate.findMany({
    where: { costCategory: CostCategory.Inbound },
    select: {
      id: true,
      unitOfMeasure: true,
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        }
      }
    }
  })

  if (containerRates.length === 0) {
    console.log('ℹ️  No container rates found. Nothing to update.')
    return
  }

  let updated = 0
  for (const rate of containerRates) {
    const currentUnit = rate.unitOfMeasure?.trim?.().toLowerCase?.() ?? ''
    const normalizedUnit = supportedUnits.find((unit) => unit === currentUnit)
    const nextUnit = normalizedUnit ?? defaultUnit

    if (rate.unitOfMeasure === nextUnit) {
      continue
    }

    await prisma.costRate.update({
      where: { id: rate.id },
      data: { unitOfMeasure: nextUnit }
    })
    updated += 1
    console.log(`✅ ${rate.warehouse.name} (${rate.warehouse.code}) → ${nextUnit}`)
  }

  console.log(`\n🎯 Completed. Updated ${updated} of ${containerRates.length} container rates.`)
}

normalizeContainerRates()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('❌ Failed to normalize container rates:', error)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
