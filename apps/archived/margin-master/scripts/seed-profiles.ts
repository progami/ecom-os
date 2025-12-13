import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding material and sourcing profiles...')

  // Create material profiles
  const materials = await Promise.all([
    prisma.materialProfile.create({
      data: {
        name: 'Premium Silicone',
        countryOfOrigin: 'CN',
        costPerUnit: 1.50, // $1.50 per m²
        costUnit: 'area',
        densityGCm3: 1.2,
        isActive: true
      }
    }),
    prisma.materialProfile.create({
      data: {
        name: 'Cotton Fabric',
        countryOfOrigin: 'IN',
        costPerUnit: 0.80, // $0.80 per m²
        costUnit: 'area',
        densityGCm3: 0.75,
        isActive: true
      }
    }),
    prisma.materialProfile.create({
      data: {
        name: 'Recycled Plastic',
        countryOfOrigin: 'US',
        costPerUnit: 0.60, // $0.60 per m²
        costUnit: 'area',
        densityGCm3: 0.95,
        isActive: true
      }
    }),
    prisma.materialProfile.create({
      data: {
        name: 'Bamboo Fiber',
        countryOfOrigin: 'VN',
        costPerUnit: 1.20, // $1.20 per m²
        costUnit: 'area',
        densityGCm3: 0.65,
        isActive: true
      }
    })
  ])

  console.log(`Created ${materials.length} material profiles`)

  // Create sourcing profiles
  const sourcingProfiles = await Promise.all([
    prisma.sourcingProfile.create({
      data: {
        name: 'China Direct',
        countryOfOrigin: 'CN',
        tariffRatePercent: 25.0,
        freightAssumptionCost: 0.50,
        freightUnit: 'per unit',
        costBufferPercent: 10.0
      }
    }),
    prisma.sourcingProfile.create({
      data: {
        name: 'India Standard',
        countryOfOrigin: 'IN',
        tariffRatePercent: 15.0,
        freightAssumptionCost: 0.75,
        freightUnit: 'per unit',
        costBufferPercent: 15.0
      }
    }),
    prisma.sourcingProfile.create({
      data: {
        name: 'US Domestic',
        countryOfOrigin: 'US',
        tariffRatePercent: 0.0,
        freightAssumptionCost: 0.30,
        freightUnit: 'per unit',
        costBufferPercent: 5.0
      }
    }),
    prisma.sourcingProfile.create({
      data: {
        name: 'Vietnam Express',
        countryOfOrigin: 'VN',
        tariffRatePercent: 12.0,
        freightAssumptionCost: 0.60,
        freightUnit: 'per unit',
        costBufferPercent: 12.0
      }
    })
  ])

  console.log(`Created ${sourcingProfiles.length} sourcing profiles`)

  // Also create some countries and programs for the fee calculation to work
  const countries = await Promise.all([
    prisma.country.create({
      data: {
        code: 'US',
        name: 'United States',
        region: 'Americas',
        currency: 'USD',
        isActive: true
      }
    }),
    prisma.country.create({
      data: {
        code: 'GB',
        name: 'United Kingdom',
        region: 'Europe',
        currency: 'GBP',
        isActive: true
      }
    }),
    prisma.country.create({
      data: {
        code: 'DE',
        name: 'Germany',
        region: 'Europe',
        currency: 'EUR',
        isActive: true
      }
    })
  ])

  console.log(`Created ${countries.length} countries`)

  // Create a basic FBA program
  const program = await prisma.program.create({
    data: {
      code: 'FBA',
      name: 'Fulfillment by Amazon',
      description: 'Amazon handles storage, packing, and shipping',
      isActive: true
    }
  })

  console.log('Created FBA program')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })