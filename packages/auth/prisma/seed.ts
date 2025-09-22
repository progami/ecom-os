import { PrismaClient } from './generated/client/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const portalAdminEmail = process.env.SEED_PORTAL_ADMIN_EMAIL || 'admin@targonglobal.com'
  const portalAdminPassword = process.env.SEED_PORTAL_ADMIN_PASSWORD || 'ChangeMe123!'

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

  const apps = [
    { slug: 'wms', name: 'Warehouse Management' },
    { slug: 'hrms', name: 'HRMS' },
    { slug: 'fcc', name: 'Finance Console' },
    { slug: 'margin-master', name: 'Margin Master' },
    { slug: 'website', name: 'Website CMS' },
    { slug: 'legal-suite', name: 'Legal Suite' },
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
    where: { email: portalAdminEmail.toLowerCase() },
    update: {
      passwordHash,
      isActive: true,
      isDemo: false,
    },
    create: {
      email: portalAdminEmail.toLowerCase(),
      username: 'portal-admin',
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

