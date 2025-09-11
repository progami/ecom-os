import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedSampleMaterials() {
  console.log('Seeding sample materials with flexible cost units...')
  
  const materials = [
    {
      name: 'Corrugated Cardboard (per m²)',
      countryOfOrigin: 'CN',
      costPerUnit: 0.85,
      costUnit: 'area',
      densityGCm3: 0.15,
      notes: 'Standard corrugated packaging material, priced per square meter',
    },
    {
      name: 'Bubble Wrap (per kg)',
      countryOfOrigin: 'US',
      costPerUnit: 3.50,
      costUnit: 'weight',
      densityGCm3: 0.03,
      notes: 'Protective bubble wrap material, priced by weight',
    },
    {
      name: 'Polystyrene Foam (per m³)',
      countryOfOrigin: 'DE',
      costPerUnit: 45.00,
      costUnit: 'volume',
      densityGCm3: 0.05,
      notes: 'Lightweight foam packaging, priced by volume',
    },
    {
      name: 'Custom Box (per piece)',
      countryOfOrigin: 'CN',
      costPerUnit: 1.25,
      costUnit: 'piece',
      densityGCm3: 0.20,
      notes: 'Pre-made custom boxes with fixed cost per unit',
    },
  ]
  
  for (const material of materials) {
    const created = await prisma.materialProfile.create({
      data: material,
    })
    console.log(`Created material: ${created.name} (${created.costPerUnit} ${created.costUnit})`)
  }
  
  console.log('Sample materials seeded successfully!')
}

seedSampleMaterials()
  .catch(console.error)
  .finally(() => prisma.$disconnect())