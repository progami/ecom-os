import { PrismaClient } from '@ecom-os/prisma-wms'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Test Database seed script')
  
  // Create demo-admin user to match test auth expectations
  const hashedPassword = await bcrypt.hash('SecureWarehouse2024!', 10)
  
  const demoAdmin = await prisma.user.upsert({
    where: { id: 'demo-admin-id' },
    update: {},
    create: {
      id: 'demo-admin-id',
      username: 'demo-admin',
      email: 'demo-admin@warehouse.com',
      fullName: 'Demo Admin',
      passwordHash: hashedPassword,
      role: 'admin',
      isActive: true,
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })
  
  console.log('✅ Created test user:', demoAdmin.username)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })