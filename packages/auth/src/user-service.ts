import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { getCentralAuthPrisma } from './db.js'

type AppEntitlementMap = Record<string, { role: string; departments: string[] }>
type UserAppRecord = {
  app: { slug: string }
  accessLevel: string
  departments: unknown
}
type UserRoleRecord = {
  role: { name: string }
}

const DEFAULT_DEMO_USERNAME = 'demo-admin'
const DEFAULT_DEMO_PASSWORD = 'demo-password'

const credentialsSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
})

export type AuthenticatedUser = {
  id: string
  email: string
  username: string | null
  fullName: string | null
  roles: string[]
  entitlements: Record<string, { role: string; departments: string[] }>
}

export async function authenticateWithCentralDirectory(input: unknown): Promise<AuthenticatedUser | null> {
  const { emailOrUsername, password } = credentialsSchema.parse(input)

  const loginValue = emailOrUsername.trim().toLowerCase()

  if (!process.env.CENTRAL_DB_URL) {
    return process.env.NODE_ENV !== 'production'
      ? handleDevFallback(loginValue, password)
      : null
  }

  const prisma = getCentralAuthPrisma()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: loginValue },
        { username: loginValue },
      ],
      isActive: true,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      appAccess: {
        include: {
          app: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    return null
  }

  const entitlements = (user.appAccess as unknown as UserAppRecord[]).reduce<AppEntitlementMap>((map, assignment) => {
    map[assignment.app.slug] = {
      role: assignment.accessLevel,
      departments: Array.isArray(assignment.departments) ? assignment.departments : [],
    }
    return map
  }, {})

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    roles: (user.roles as unknown as UserRoleRecord[]).map(r => r.role.name),
    entitlements,
  }
}

function handleDevFallback(emailOrUsername: string, password: string): AuthenticatedUser | null {
  const demoUsername = (process.env.DEMO_ADMIN_USERNAME || DEFAULT_DEMO_USERNAME).toLowerCase()
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_PASSWORD

  if (emailOrUsername !== demoUsername) {
    return null
  }

  if (password !== demoPassword) {
    return null
  }

  const entitlements: AppEntitlementMap = {
    wms: { role: 'admin', departments: ['Ops'] },
    fcc: { role: 'admin', departments: ['Finance'] },
    hrms: { role: 'admin', departments: ['People Ops'] },
    'margin-master': { role: 'admin', departments: ['Product'] },
  }

  return {
    id: 'dev-demo-admin',
    email: process.env.DEMO_ADMIN_EMAIL || 'dev-admin@targonglobal.com',
    username: demoUsername,
    fullName: 'Development Admin',
    roles: ['admin'],
    entitlements,
  }
}

export async function getUserEntitlements(userId: string) {
  if (!process.env.CENTRAL_DB_URL) {
    return {}
  }

  const prisma = getCentralAuthPrisma()

  const assignments = await prisma.userApp.findMany({
    where: { userId },
    include: { app: true },
  })

  return (assignments as unknown as UserAppRecord[]).reduce<AppEntitlementMap>((map, assignment) => {
    map[assignment.app.slug] = {
      role: assignment.accessLevel,
      departments: Array.isArray(assignment.departments) ? assignment.departments : [],
    }
    return map
  }, {})
}
