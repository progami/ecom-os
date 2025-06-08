import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating/updating users...')
  
  const adminPassword = await bcrypt.hash('admin123', 10)
  const staffPassword = await bcrypt.hash('staff123', 10)
  
  try {
    // Update admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@warehouse.com' },
      update: {
        username: 'admin',
        passwordHash: adminPassword,
        fullName: 'System Administrator',
        isActive: true,
      },
      create: {
        email: 'admin@warehouse.com',
        username: 'admin',
        passwordHash: adminPassword,
        fullName: 'System Administrator',
        role: 'admin' as any,
        isActive: true,
      },
    })
    console.log('✓ Admin user:', admin.email, '(username: admin)')
    
    // Create/update Hashar
    const hashar = await prisma.user.upsert({
      where: { email: 'hashar@warehouse.com' },
      update: {
        username: 'hashar',
        passwordHash: staffPassword,
        fullName: 'Hashar (Finance Manager)',
        isActive: true,
      },
      create: {
        email: 'hashar@warehouse.com',
        username: 'hashar',
        passwordHash: staffPassword,
        fullName: 'Hashar (Finance Manager)',
        role: 'staff', // Finance staff role
        isActive: true,
      },
    })
    console.log('✓ Created user:', hashar.email, '(username: hashar) - Finance Manager')
    
    // Get a warehouse for Umair
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true }
    })
    
    // Create/update Umair
    const umair = await prisma.user.upsert({
      where: { email: 'umair@warehouse.com' },
      update: {
        username: 'umair',
        passwordHash: staffPassword,
        fullName: 'Umair (Operations Manager)',
        warehouseId: warehouse?.id,
        isActive: true,
      },
      create: {
        email: 'umair@warehouse.com',
        username: 'umair',
        passwordHash: staffPassword,
        fullName: 'Umair (Operations Manager)',
        role: 'staff', // Operations staff role
        warehouseId: warehouse?.id,
        isActive: true,
      },
    })
    console.log('✓ Created user:', umair.email, '(username: umair) - Operations Manager')
    
    console.log('\n✅ Users created successfully!')
    console.log('\nLogin credentials (email or username / password):')
    console.log('- admin@warehouse.com (or admin) / admin123')
    console.log('- hashar@warehouse.com (or hashar) / staff123')
    console.log('- umair@warehouse.com (or umair) / staff123')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()