import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating staff users...')
  
  const staffPassword = await bcrypt.hash('staff123', 10)
  
  try {
    // Create/update Hashar as Finance Manager
    const hashar = await prisma.user.upsert({
      where: { email: 'hashar@warehouse.com' },
      update: {
        passwordHash: staffPassword,
        fullName: 'Hashar (Finance Manager)',
        role: 'staff',
        isActive: true,
      },
      create: {
        email: 'hashar@warehouse.com',
        passwordHash: staffPassword,
        fullName: 'Hashar (Finance Manager)',
        role: 'staff',
        isActive: true,
      },
    })
    console.log('✓ Created:', hashar.email, '- Finance Manager')
    
    // Get a warehouse for Umair
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true }
    })
    
    // Create/update Umair as Operations Manager
    const umair = await prisma.user.upsert({
      where: { email: 'umair@warehouse.com' },
      update: {
        passwordHash: staffPassword,
        fullName: 'Umair (Operations Manager)',
        role: 'staff',
        warehouseId: warehouse?.id,
        isActive: true,
      },
      create: {
        email: 'umair@warehouse.com',
        passwordHash: staffPassword,
        fullName: 'Umair (Operations Manager)',
        role: 'staff',
        warehouseId: warehouse?.id,
        isActive: true,
      },
    })
    console.log('✓ Created:', umair.email, '- Operations Manager')
    
    console.log('\n✅ Staff users created successfully!')
    console.log('\nLogin credentials:')
    console.log('- hashar@warehouse.com / staff123 (Finance Manager)')
    console.log('- umair@warehouse.com / staff123 (Operations Manager)')
    console.log('- admin@warehouse.com / admin123 (System Admin)')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()