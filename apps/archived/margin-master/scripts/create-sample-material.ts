import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createSampleMaterial() {
  try {
    const material = await prisma.materialProfile.create({
      data: {
        name: "Corrugated Cardboard - Premium",
        countryOfOrigin: "US",
        densityGCm3: 0.25,
        thicknessOptions: [1.5, 2.0, 3.0, 4.0], // mm
        maxSheetLength: 300, // cm
        maxSheetWidth: 200, // cm
        costPerUnit: 2.50,
        costUnit: "area",
        minOrderQuantity: 50, // 50 m²
        setupCost: 150,
        wasteFactor: 0.15, // 15% waste
        maxBendRadius: 2.0, // cm
        isRigid: false,
        requiresLiner: false,
        notes: "High-quality corrugated cardboard for premium packaging"
      }
    })
    
    console.log("Created sample material:", material)
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleMaterial()