#!/usr/bin/env npx tsx

/**
 * Setup script: core product catalogue
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @targon/talos exec tsx scripts/setup/products.ts [--skip-clean] [--verbose]
 */

import { PrismaClient } from '@targon/prisma-talos'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

function log(message: string, data?: unknown) {
  console.log(`[setup][products] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

const PRODUCTS = [
  {
    skuCode: 'CS-008',
    description: 'Pack of 3 - LD',
    asin: 'B0C7ZQ3VZL',
    packSize: 3,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×1.2',
    unitWeightKg: 0.16,
    unitsPerCarton: 60,
    cartonDimensionsCm: '40×28×29.5',
    cartonWeightKg: 10,
    packagingType: 'Poly bag',
  },
  {
    skuCode: 'CS-010',
    description: 'Pack of 3 - ST',
    asin: 'B0CR1GSBQ9',
    packSize: 3,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×2',
    unitWeightKg: 0.41,
    unitsPerCarton: 52,
    cartonDimensionsCm: '41×28×39.5',
    cartonWeightKg: 21,
    packagingType: 'Poly bag',
  },
  {
    skuCode: 'CS-007',
    description: 'Pack of 6 - LD',
    asin: 'B09HXC3NL8',
    packSize: 6,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×2.3',
    unitWeightKg: 0.35,
    unitsPerCarton: 60,
    cartonDimensionsCm: '40×44×52.5',
    cartonWeightKg: 21.3,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-011',
    description: 'Pack of 6 - ST',
    asin: 'B0DHDTPGCP',
    packSize: 6,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×3.8',
    unitWeightKg: 0.84,
    unitsPerCarton: 24,
    cartonDimensionsCm: '41×26×51.5',
    cartonWeightKg: 20,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-009',
    description: 'Pack of 10 - LD',
    asin: 'B0CR1H3VSF',
    packSize: 10,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×3.8',
    unitWeightKg: 0.56,
    unitsPerCarton: 36,
    cartonDimensionsCm: '38×44×52.5',
    cartonWeightKg: 20.4,
    packagingType: 'Box',
  },
  {
    skuCode: 'CS-012',
    description: 'Pack of 10 - ST',
    asin: 'B0DHHCYZSH',
    packSize: 10,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×6.3',
    unitWeightKg: 1.36,
    unitsPerCarton: 16,
    cartonDimensionsCm: '44×27×51.5',
    cartonWeightKg: 22,
    packagingType: 'Box',
  },
] as const

async function cleanProducts() {
  if (skipClean) {
    log('Skipping product clean up')
    return
  }

  await prisma.sku.deleteMany()
  log('Removed existing SKUs')
}

async function upsertProducts() {
  for (const product of PRODUCTS) {
    await prisma.sku.upsert({
      where: { skuCode: product.skuCode },
      create: product,
      update: product,
    })
    log(`Upserted ${product.skuCode}`)
  }
}

async function main() {
  try {
    await cleanProducts()
    await upsertProducts()
    log('Product setup complete')
  } catch (error) {
    console.error('[setup][products] failed', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()

export {}
