import { PrismaClient } from '../node_modules/.prisma/client-auth'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const portalAdminEmail = process.env.SEED_PORTAL_ADMIN_EMAIL?.trim().toLowerCase()
  const portalAdminPassword = process.env.SEED_PORTAL_ADMIN_PASSWORD

  if (!portalAdminEmail) {
    throw new Error('SEED_PORTAL_ADMIN_EMAIL is required for seeding. Provide a real admin email via the environment.')
  }

  if (!portalAdminPassword || portalAdminPassword.length < 12) {
    throw new Error('SEED_PORTAL_ADMIN_PASSWORD is required and must be at least 12 characters long.')
  }

  const passwordHash = await bcrypt.hash(portalAdminPassword, 12)

  const [adminRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', description: 'Full administrative access' },
    }),
    prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: { name: 'manager', description: 'Operational management role' },
    }),
    prisma.role.upsert({
      where: { name: 'staff' },
      update: {},
      create: { name: 'staff', description: 'Standard application access' },
    }),
    prisma.role.upsert({
      where: { name: 'viewer' },
      update: {},
      create: { name: 'viewer', description: 'Read-only access' },
    }),
  ])

  const username = portalAdminEmail.split('@')[0] ?? portalAdminEmail

  const apps = [
    { slug: 'wms', name: 'Warehouse Management' },
    { slug: 'hrms', name: 'HRMS' },
    { slug: 'website', name: 'Website CMS' },
    { slug: 'x-plan', name: 'X-Plan' },
  ]

  await Promise.all(
    apps.map(app =>
      prisma.app.upsert({
        where: { slug: app.slug },
        update: {},
        create: { ...app },
      })
    )
  )

  const adminUser = await prisma.user.upsert({
    where: { email: portalAdminEmail },
    update: {
      passwordHash,
      isActive: true,
      isDemo: false,
      username,
    },
    create: {
      email: portalAdminEmail,
      username,
      passwordHash,
      firstName: 'Portal',
      lastName: 'Admin',
      isActive: true,
      isDemo: false,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  })

  const appRecords = await prisma.app.findMany({ select: { id: true, slug: true } })

  await Promise.all(
    appRecords.map(app =>
      prisma.userApp.upsert({
        where: {
          userId_appId: {
            userId: adminUser.id,
            appId: app.id,
          },
        },
        update: {},
        create: {
          userId: adminUser.id,
          appId: app.id,
          accessLevel: 'admin',
        },
      })
    )
  )

  console.log('Seed completed. Portal admin:', portalAdminEmail)
}

main()
  .catch(error => {
    console.error('Seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
