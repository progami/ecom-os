import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createLDPEMaterial() {
  try {
    // Create a simple LDPE dust sheet material
    const material = await prisma.materialProfile.create({
      data: {
        name: "LDPE Dust Sheet - Clear",
        countryOfOrigin: "IN", // India
        
        // Physical properties
        densityGCm3: 0.92, // Standard LDPE density
        thicknessOptions: [0.1, 0.15, 0.2, 0.3], // Common thicknesses in mm
        
        // Cost - Let's use area-based pricing (most intuitive for sheets)
        costPerUnit: 10, // Rs 10 per m²
        costUnit: "area",
        
        // Simple defaults
        wasteFactor: 0.05, // 5% waste (rolls have minimal waste)
        isRigid: false,
        requiresLiner: false,
        
        notes: "Standard LDPE plastic dust sheet for construction protection. Sold in rolls."
      }
    })
    
    console.log("Created LDPE material:", material)
    console.log("\nQuick reference:")
    console.log("- 1 m² at 0.1mm = 92g")
    console.log("- 1 m² at 0.2mm = 184g")
    console.log("- Standard 4m × 50m roll = 200 m²")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

createLDPEMaterial()