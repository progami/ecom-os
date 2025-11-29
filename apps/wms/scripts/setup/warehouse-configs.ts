#!/usr/bin/env npx tsx

/**
 * Setup script: warehouses + cost rates
 * --------------------------------------------------
 * - Creates default warehouses if missing
 * - Seeds baseline storage / handling cost rates
 *
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/warehouse-configs.ts [--skip-clean] [--verbose]
 */

import { PrismaClient, UserRole, CostCategory, Prisma } from '@ecom-os/prisma-wms'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

function log(message: string, data?: unknown) {
  console.log(`[setup][warehouses] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function ensureAdminUser() {
  let admin = await prisma.user.findFirst({ where: { role: UserRole.admin } })
  if (!admin) {
    const passwordHash = await bcrypt.hash('setup123', 10)
    admin = await prisma.user.create({
      data: {
        email: 'setup-admin@local.test',
        fullName: 'Setup Admin',
        role: UserRole.admin,
        passwordHash,
      },
    })
    log('Created fallback admin user setup-admin@local.test (password: setup123)')
  }
  return admin
}

async function upsertWarehouses() {
  const warehouses = [
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

  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      create: warehouse,
      update: {
        name: warehouse.name,
        address: warehouse.address,
      },
    })
    log(`Warehouse ready: ${warehouse.code}`)
  }
}

async function seedCostRates() {
  if (!skipClean) {
    await prisma.costRate.deleteMany()
    log('Cleared existing cost rates')
  }

  const warehouses = await prisma.warehouse.findMany()
  if (warehouses.length === 0) {
    log('No warehouses found; skipping cost rate setup')
    return
  }

  const admin = await ensureAdminUser()
  const today = new Date()
  const effectiveDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  const rates = warehouses.flatMap(warehouse => [
    {
      warehouseId: warehouse.id,
      costCategory: CostCategory.Storage,
      costName: 'Storage Base Rate',
      costValue: new Prisma.Decimal(18),
      unitOfMeasure: 'PALLET_MONTH',
      effectiveDate,
      isActive: true,
      createdById: admin.id,
    },
  ])

  if (rates.length > 0) {
    await prisma.costRate.createMany({ data: rates })
    log(`Seeded ${rates.length} cost rates`)
  }
}

async function main() {
  try {
    await upsertWarehouses()
    await seedCostRates()
    log('Warehouse setup complete')
  } catch (error) {
    console.error('[setup][warehouses] failed', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()

export {}
