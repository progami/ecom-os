import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create simplified permissions - just admin and staff
  const permissions = [
    { name: 'admin' },
    { name: 'staff' },
  ]

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    })
  }

  // Get permissions
  const adminPermission = await prisma.permission.findUnique({ where: { name: 'admin' } })
  const staffPermission = await prisma.permission.findUnique({ where: { name: 'staff' } })

  // Create simplified users
  const users = [
    {
      email: 'jarraramjad@ecomos.com',
      password: 'SecurePass123!',
      name: 'Jarrar Amjad',
      role: 'admin',
      permissions: [adminPermission!, staffPermission!],
    },
    {
      email: 'admin@ecomos.com',
      password: 'AdminPass123!',
      name: 'Admin User',
      role: 'admin',
      permissions: [adminPermission!, staffPermission!],
    },
    {
      email: 'staff@ecomos.com',
      password: 'StaffPass123!',
      name: 'Staff User',
      role: 'staff',
      permissions: [staffPermission!],
    },
  ]

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10)
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        password: hashedPassword,
        name: user.name,
        role: user.role,
        permissions: {
          set: user.permissions.map(p => ({ id: p.id })),
        },
      },
      create: {
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
        permissions: {
          connect: user.permissions.map(p => ({ id: p.id })),
        },
      },
    })
  }

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })