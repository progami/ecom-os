import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create warehouses
  const warehouse1 = await prisma.warehouse.upsert({
    where: { code: 'FMC' },
    update: {},
    create: {
      code: 'FMC',
      name: 'FMC',
      address: 'Star Business Centre, Marsh Wy, Rainham RM13 8UP, UK',
      contactEmail: 'fmc@warehouse.com',
      contactPhone: '555-0100',
    },
  })

  const warehouse2 = await prisma.warehouse.upsert({
    where: { code: 'VGLOBAL' },
    update: {},
    create: {
      code: 'VGLOBAL',
      name: 'VGlobal',
      address: 'Unit 2, Bulrush Close, Finedon Road, Wellingborough, NN8 4FU, UK',
      contactEmail: 'dale.ashton@trans-global.com',
      contactPhone: '+447789332674',
    },
  })

  const warehouse3 = await prisma.warehouse.upsert({
    where: { code: '4AS' },
    update: {},
    create: {
      code: '4AS',
      name: '4AS',
      address: 'Unit E, 1 Glenburn Rd, East Kilbride, Glasgow, G74 5BA, UK',
      contactEmail: 'support@4asglobal.com',
      contactPhone: '+447926124504',
    },
  })

  console.log('✅ Created warehouses: FMC, VGlobal, 4AS')

  // Create users
  const adminPassword = await bcrypt.hash('SecureWarehouse2024!', 10)
  const staffPassword = await bcrypt.hash('StaffAccess2024!', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@warehouse.com' },
    update: {},
    create: {
      email: 'admin@warehouse.com',
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'System Administrator',
      role: UserRole.admin,
    },
  })

  const hasharUser = await prisma.user.upsert({
    where: { email: 'hashar@warehouse.com' },
    update: {},
    create: {
      email: 'hashar@warehouse.com',
      username: 'hashar',
      passwordHash: staffPassword,
      fullName: 'Hashar (Finance Manager)',
      role: UserRole.staff,
    },
  })

  const umairUser = await prisma.user.upsert({
    where: { email: 'umair@warehouse.com' },
    update: {},
    create: {
      email: 'umair@warehouse.com',
      username: 'umair',
      passwordHash: staffPassword,
      fullName: 'Umair (Operations Manager)',
      role: UserRole.staff,
      warehouseId: warehouse1.id,
    },
  })

  console.log('✅ Created users:')
  console.log('   - admin@warehouse.com / admin (password: SecureWarehouse2024!)')
  console.log('   - hashar@warehouse.com / hashar (password: StaffAccess2024!)')
  console.log('   - umair@warehouse.com / umair (password: StaffAccess2024!)')
  
  console.log('\n✅ Database seed completed!')
  console.log('📝 Note: SKUs, cost rates, and warehouse configurations should be imported from Excel')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })