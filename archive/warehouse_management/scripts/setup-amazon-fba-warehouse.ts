import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupAmazonFBAWarehouse() {
  try {
    console.log('Setting up Amazon FBA UK warehouse...\n')
    
    // Get system user
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@warehouse.com' }
    })
    
    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: 'system@warehouse.com',
          passwordHash: 'not-used',
          fullName: 'System',
          role: 'admin',
          isActive: false
        }
      })
    }
    
    // Create or update Amazon FBA warehouse
    let amazonWarehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: 'AMZN-UK' },
          { code: 'AMZN' }
        ]
      }
    })
    
    if (!amazonWarehouse) {
      console.log('Creating Amazon FBA UK warehouse...')
      amazonWarehouse = await prisma.warehouse.create({
        data: {
          code: 'AMZN-UK',
          name: 'Amazon FBA UK',
          address: 'Amazon Fulfillment Centers UK',
          isActive: true
        }
      })
      console.log('✓ Created Amazon FBA UK warehouse')
    } else {
      console.log('✓ Amazon FBA UK warehouse already exists')
    }
    
    // Create Amazon storage rates
    const currentYear = new Date().getFullYear()
    
    // Define seasonal rates for Amazon
    const amazonRates = [
      {
        name: 'Amazon FBA Storage - Standard (Jan-Sep)',
        value: 0.75, // £0.75 per cubic foot per month
        unit: 'cubic foot/month',
        category: 'Storage' as const,
        effectiveDate: new Date(`${currentYear}-01-01`),
        endDate: new Date(`${currentYear}-09-30`),
        notes: 'Amazon FBA standard size storage fee for Jan-Sep period'
      },
      {
        name: 'Amazon FBA Storage - Oversize (Jan-Sep)',
        value: 0.53, // £0.53 per cubic foot per month
        unit: 'cubic foot/month',
        category: 'Storage' as const,
        effectiveDate: new Date(`${currentYear}-01-01`),
        endDate: new Date(`${currentYear}-09-30`),
        notes: 'Amazon FBA oversize storage fee for Jan-Sep period'
      },
      {
        name: 'Amazon FBA Storage - Standard (Oct-Dec)',
        value: 2.40, // £2.40 per cubic foot per month (peak season)
        unit: 'cubic foot/month',
        category: 'Storage' as const,
        effectiveDate: new Date(`${currentYear}-10-01`),
        endDate: new Date(`${currentYear}-12-31`),
        notes: 'Amazon FBA standard size storage fee for Oct-Dec peak season'
      },
      {
        name: 'Amazon FBA Storage - Oversize (Oct-Dec)',
        value: 1.65, // £1.65 per cubic foot per month (peak season)
        unit: 'cubic foot/month',
        category: 'Storage' as const,
        effectiveDate: new Date(`${currentYear}-10-01`),
        endDate: new Date(`${currentYear}-12-31`),
        notes: 'Amazon FBA oversize storage fee for Oct-Dec peak season'
      }
    ]
    
    console.log('\nCreating Amazon FBA storage rates...')
    
    for (const rate of amazonRates) {
      // Check if rate already exists for this period
      const existingRate = await prisma.costRate.findFirst({
        where: {
          warehouseId: amazonWarehouse.id,
          costName: rate.name,
          effectiveDate: { lte: rate.effectiveDate },
          OR: [
            { endDate: null },
            { endDate: { gte: rate.effectiveDate } }
          ]
        }
      })
      
      if (!existingRate) {
        await prisma.costRate.create({
          data: {
            warehouseId: amazonWarehouse.id,
            costCategory: rate.category,
            costName: rate.name,
            costValue: rate.value,
            unitOfMeasure: rate.unit,
            effectiveDate: rate.effectiveDate,
            endDate: rate.endDate,
            notes: rate.notes,
            createdById: systemUser.id
          }
        })
        console.log(`✓ Created rate: ${rate.name} - £${rate.value}/${rate.unit}`)
      } else {
        console.log(`⚠️  Rate already exists: ${rate.name}`)
      }
    }
    
    // Note: Amazon FBA doesn't need warehouse SKU configs as it uses cubic feet
    // The warehouseSkuConfigs are for SKU-specific pallet configurations
    console.log('\n✓ Amazon FBA uses cubic feet for storage - no pallet configuration needed')
    
    console.log('\nAmazon FBA UK warehouse setup complete!')
    console.log('\nNotes:')
    console.log('- Amazon FBA uses cubic feet for storage calculations')
    console.log('- Storage rates are seasonal (Jan-Sep vs Oct-Dec)')
    console.log('- Monthly rates are converted to weekly in storage ledger calculations')
    console.log('- This warehouse is excluded from pallet-based calculations')
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

setupAmazonFBAWarehouse()