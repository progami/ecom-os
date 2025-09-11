import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create or update dev user to match the dev-bypass user ID
  const user = await prisma.user.upsert({
    where: { id: 'dev-user-123' },
    update: {
      email: 'dev@example.com',
      name: 'Dev User',
      tenantId: 'dev-tenant-123',
      tenantName: 'Dev Organization'
    },
    create: {
      id: 'dev-user-123',
      email: 'dev@example.com',
      password: 'not-used-in-dev-bypass',
      name: 'Dev User',
      hasCompletedSetup: true,
      tenantId: 'dev-tenant-123',
      tenantName: 'Dev Organization'
    }
  })
  
  console.log('Dev user created/updated:', user.id, user.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
