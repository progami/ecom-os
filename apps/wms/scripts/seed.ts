#!/usr/bin/env npx tsx
/**
 * Seed Script - Sets up base data using Prisma
 * This includes: users, warehouses, SKUs, and cost rates
 * For transactions, use the demo.ts script with Playwright
 */

import { PrismaClient } from '@ecom-os/prisma-wms'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Parse command line arguments
const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const skipUsers = args.includes('--skip-users')
const skipWarehouses = args.includes('--skip-warehouses')
const skipProducts = args.includes('--skip-products')
const skipCostRates = args.includes('--skip-cost-rates')
const verbose = args.includes('--verbose')

function log(message: string, data?: any) {
  console.log(`[SEED] ${message}`)
  if (verbose && data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function cleanDatabase() {
  if (skipClean) {
    log('Skipping database cleanup...')
    return
  }

  log('Cleaning database...')
  
  // Delete in correct order to respect foreign keys
  await prisma.costLedger.deleteMany()
  await prisma.storageLedger.deleteMany()
  await prisma.inventoryTransaction.deleteMany()
  await prisma.costRate.deleteMany()
  await prisma.sku.deleteMany()
  await prisma.user.deleteMany()
  await prisma.warehouse.deleteMany()
  
  log('Database cleaned successfully')
}

async function createUsers() {
  if (skipUsers) {
    log('Skipping user creation...')
    return
  }

  log('Creating users...')
  
  const hashedPassword = await bcrypt.hash('test123', 10)
  
  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      fullName: 'Admin User',
      role: 'admin',
      passwordHash: hashedPassword
    }
  })
  log('Created admin user: admin@test.com')
}

async function createWarehouses() {
  if (skipWarehouses) {
    log('Skipping warehouse creation...')
    return
  }

  log('Creating warehouses...')
  
  const warehouses = [
    {
      code: 'FMC',
      name: 'FMC',
      address: '123 Logistics Way, USA'
    },
    {
      code: 'VGLOBAL',
      name: 'Vglobal',
      address: '456 Distribution Center, USA'
    }
  ]
  
  for (const warehouse of warehouses) {
    const existing = await prisma.warehouse.findUnique({
      where: { code: warehouse.code }
    })
    
    if (existing) {
      log(`Warehouse already exists: ${warehouse.name} (${warehouse.code})`)
    } else {
      await prisma.warehouse.create({ data: warehouse })
      log(`Created warehouse: ${warehouse.name} (${warehouse.code})`)
    }
  }
}

async function createProducts() {
  if (skipProducts) {
    log('Skipping product creation...')
    return
  }

  log('Creating products/SKUs...')
  
  const skuSpecs = [
    {
      skuCode: 'CS-008',
      description: 'Pack of 3 - LD',
      asin: 'B0C7ZQ3VZL',
      unitDims: '25×20.5×1.2',
      unitWeight: 0.16,
      cartonDims: '40×28×29.5',
      cartonWeight: 10,
      unitsPerCarton: 60,
      packSize: 3,
      material: '7 Micron',
      packagingType: 'Poly bag'
    },
    {
      skuCode: 'CS-010',
      description: 'Pack of 3 - ST',
      asin: 'B0CR1GSBQ9',
      unitDims: '25×20.5×2',
      unitWeight: 0.41,
      cartonDims: '41×28×39.5',
      cartonWeight: 21,
      unitsPerCarton: 52,
      packSize: 3,
      material: '15 Micron',
      packagingType: 'Poly bag'
    },
    {
      skuCode: 'CS-007',
      description: 'Pack of 6 - LD',
      asin: 'B09HXC3NL8',
      unitDims: '25×20.5×2.3',
      unitWeight: 0.35,
      cartonDims: '40×44×52.5',
      cartonWeight: 21.3,
      unitsPerCarton: 60,
      packSize: 6,
      material: '7 Micron',
      packagingType: 'Box'
    },
    {
      skuCode: 'CS-011',
      description: 'Pack of 6 - ST',
      asin: 'B0DHDTPGCP',
      unitDims: '25×20.5×3.8',
      unitWeight: 0.84,
      cartonDims: '41×26×51.5',
      cartonWeight: 20,
      unitsPerCarton: 24,
      packSize: 6,
      material: '15 Micron',
      packagingType: 'Box'
    },
    {
      skuCode: 'CS-009',
      description: 'Pack of 10 - LD',
      asin: 'B0CR1H3VSF',
      unitDims: '25×20.5×3.8',
      unitWeight: 0.56,
      cartonDims: '38×44×52.5',
      cartonWeight: 20.4,
      unitsPerCarton: 36,
      packSize: 10,
      material: '7 Micron',
      packagingType: 'Box'
    },
    {
      skuCode: 'CS-012',
      description: 'Pack of 10 - ST',
      asin: 'B0DHHCYZSH',
      unitDims: '25×20.5×6.3',
      unitWeight: 1.36,
      cartonDims: '44×27×51.5',
      cartonWeight: 22,
      unitsPerCarton: 16,
      packSize: 10,
      material: '15 Micron',
      packagingType: 'Box'
    },
    {
      skuCode: 'CS-CDS-001',
      description: 'CDS-001',
      asin: 'B0CW3N48K1',
      unitDims: '30×20×5.5',
      unitWeight: 0.68,
      cartonDims: '32×60×53',
      cartonWeight: 22.44,
      unitsPerCarton: 33,
      packSize: 1,
      material: '4 oz',
      packagingType: 'Box'
    },
    {
      skuCode: 'CS-CDS-002',
      description: 'CDS-002',
      asin: 'B0CW3L6PQH',
      unitDims: '30×20×10',
      unitWeight: 1.38,
      cartonDims: '32×60×50',
      cartonWeight: 19.32,
      unitsPerCarton: 14,
      packSize: 1,
      material: '4 oz',
      packagingType: 'Box'
    }
  ]
  
  for (const spec of skuSpecs) {
    const sku = await prisma.sku.create({
      data: {
        skuCode: spec.skuCode,
        description: spec.description,
        asin: spec.asin,
        unitDimensionsCm: spec.unitDims,
        unitWeightKg: spec.unitWeight,
        cartonDimensionsCm: spec.cartonDims,
        cartonWeightKg: spec.cartonWeight,
        unitsPerCarton: spec.unitsPerCarton,
        material: spec.material,
        packagingType: spec.packagingType,
        packSize: spec.packSize,
        isActive: true
      }
    })
    log(`Created SKU: ${spec.skuCode} - ${spec.description}`)
  }
}

async function createCostRates() {
  if (skipCostRates) {
    log('Skipping cost rate creation...')
    return
  }

  log('Creating cost rates...')
  
  // Get all warehouses
  const warehouses = await prisma.warehouse.findMany()
  
  if (warehouses.length === 0) {
    log('No warehouses found, skipping cost rates')
    return
  }
  
  // Try to find any admin user for the createdById field
  let adminUser = await prisma.user.findFirst({
    where: { role: 'admin' }
  })
  
  // If no admin, try to find any user
  if (!adminUser) {
    adminUser = await prisma.user.findFirst()
  }
  
  if (!adminUser) {
    log('No users found in database. Cost rates require a user for audit trail.')
    log('Please create at least one user first, then run cost rate seeding.')
    return
  }
  
  const costRatesByWarehouse = {
    'FMC': [
      { category: 'Container', name: 'Terminal Handling Charges', costValue: 185, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Port Processing Fee', costValue: 24.5, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Documentation Fee', costValue: 65, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Container Inspection', costValue: 20, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Customs Clearance', costValue: 20, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Port Charges', costValue: 32, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Deferment Fee', costValue: 30, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Haulage', costValue: 835, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Container Unloading', costValue: 500, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Freight', costValue: 2000, unitOfMeasure: 'container' },
      { category: 'Carton', name: 'Carton Handling Cost', costValue: 1.3, unitOfMeasure: 'carton' },
      { category: 'Carton', name: 'Carton Unloading Cost', costValue: 1.75, unitOfMeasure: 'carton' },
      { category: 'Storage', name: 'Storage cost per pallet / week', costValue: 3.9, unitOfMeasure: 'pallet/week' },
      { category: 'Pallet', name: 'Pallet handling', costValue: 6.75, unitOfMeasure: 'pallet' },
      { category: 'transportation', name: 'LTL', costValue: 50, unitOfMeasure: 'shipment' },
      { category: 'transportation', name: 'FTL', costValue: 500, unitOfMeasure: 'shipment' }
    ],
    'VGLOBAL': [
      { category: 'Container', name: 'Terminal Handling Charges', costValue: 185, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Port Processing Fee', costValue: 24.5, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Documentation Fee', costValue: 65, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Container Inspection', costValue: 20, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Customs Clearance', costValue: 20, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Port Charges', costValue: 32, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Deferment Fee', costValue: 30, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Haulage', costValue: 835, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Container Unloading', costValue: 390, unitOfMeasure: 'container' },
      { category: 'Container', name: 'Freight', costValue: 2000, unitOfMeasure: 'container' },
      { category: 'Carton', name: 'Carton Handling Cost', costValue: 1.4, unitOfMeasure: 'carton' },
      { category: 'Pallet', name: 'Pallet Unloading Cost', costValue: 11.7, unitOfMeasure: 'pallet' },
      { category: 'Storage', name: 'Storage cost per pallet / week', costValue: 2.6, unitOfMeasure: 'pallet/week' },
      { category: 'Pallet', name: 'Pallet handling', costValue: 6.95, unitOfMeasure: 'pallet' },
      { category: 'transportation', name: 'LTL', costValue: 50, unitOfMeasure: 'shipment' },
      { category: 'transportation', name: 'FTL', costValue: 350, unitOfMeasure: 'shipment' }
    ]
  }
  
  const today = new Date()
  
  for (const warehouse of warehouses) {
    const rates = costRatesByWarehouse[warehouse.code] || []
    let createdCount = 0
    
    for (const cost of rates) {
      // Check if this cost rate already exists
      const existing = await prisma.costRate.findFirst({
        where: {
          warehouseId: warehouse.id,
          costName: cost.name
        }
      })
      
      if (existing) {
        log(`Cost rate already exists for ${cost.category} in ${warehouse.code}`)
      } else {
        await prisma.costRate.create({
          data: {
            warehouseId: warehouse.id,
            costCategory: cost.category as any,
            costName: cost.name,
            costValue: cost.costValue,
            unitOfMeasure: cost.unitOfMeasure,
            effectiveDate: today,
            isActive: true,
            createdById: adminUser.id
          }
        })
        createdCount++
      }
    }
    log(`Created ${createdCount} new cost rates for ${warehouse.name} (${rates.length} total defined)`)
  }
}

async function main() {
  try {
    console.log('='.repeat(50))
    console.log('WMS SEED SCRIPT')
    console.log('='.repeat(50))
    console.log('This script sets up base data using Prisma')
    console.log('For transactions, use scripts/demo.ts')
    console.log('')
    console.log('Options:')
    console.log('  --skip-clean       Don\'t clean existing data')
    console.log('  --skip-users       Don\'t create users')
    console.log('  --skip-warehouses  Don\'t create warehouses')
    console.log('  --skip-products    Don\'t create products/SKUs')
    console.log('  --skip-cost-rates  Don\'t create cost rates')
    console.log('  --verbose          Show detailed output')
    console.log('='.repeat(50))
    console.log('')
    
    await cleanDatabase()
    await createUsers()
    await createWarehouses()
    await createProducts()
    await createCostRates()
    
    console.log('')
    console.log('='.repeat(50))
    console.log('✅ SEED COMPLETED SUCCESSFULLY')
    console.log('='.repeat(50))
    console.log('')
    console.log('Summary:')
    const [userCount, warehouseCount, skuCount, costRateCount] = await Promise.all([
      prisma.user.count(),
      prisma.warehouse.count(),
      prisma.sku.count(),
      prisma.costRate.count()
    ])
    console.log(`  Users:       ${userCount}`)
    console.log(`  Warehouses:  ${warehouseCount}`)
    console.log(`  SKUs:        ${skuCount}`)
    console.log(`  Cost Rates:  ${costRateCount}`)
    console.log('')
    console.log('Login Credentials:')
    console.log('  admin@test.com / test123')
    console.log('')
    console.log('Next: Run scripts/demo.ts to create transactions via UI')
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('Error in seed script:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
