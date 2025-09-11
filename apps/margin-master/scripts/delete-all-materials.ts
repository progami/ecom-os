import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllMaterials() {
  try {
    const deleted = await prisma.materialProfile.deleteMany({})
    console.log(`Deleted ${deleted.count} materials`)
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAllMaterials()
