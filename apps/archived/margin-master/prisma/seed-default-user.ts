import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Check if default user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: 'default-user-id' }
  })

  if (!existingUser) {
    // Create default user
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    await prisma.user.create({
      data: {
        id: 'default-user-id',
        email: 'demo@marginmaster.com',
        name: 'Demo User',
        password: hashedPassword,
        role: 'STAFF'
      }
    })
    
    console.log('Default user created successfully')
  } else {
    console.log('Default user already exists')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })