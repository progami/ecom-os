import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hash password
  const hashedPassword = await bcrypt.hash('testpassword123', 10)
  
  // Create or update test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      hasCompletedSetup: true,
      tenantId: 'test-tenant-123',
      tenantName: 'Test Organization'
    }
  })
  
  console.log('Test user created:', user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
