import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { getPortalAuthPrisma } from './db.js'

type AppEntitlementMap = Record<string, { departments: string[] }>

const DEFAULT_DEMO_USERNAME = 'demo-admin'
const DEFAULT_DEMO_PASSWORD = 'demo-password'
const DEMO_ADMIN_UUID = '00000000-0000-4000-a000-000000000001'

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
  entitlements: Record<string, { departments: string[] }>
}

const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  passwordHash: true,
  roles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
  appAccess: {
    select: {
      departments: true,
      app: {
        select: {
          slug: true,
        },
      },
    },
  },
} as const

type PortalUserRecord = {
  id: string
  email: string
  username: string | null
  firstName: string | null
  lastName: string | null
  passwordHash: string
  roles: Array<{ role: { name: string } }>
  appAccess: Array<{ departments: unknown; app: { slug: string } }>
}

export async function authenticateWithPortalDirectory(input: unknown): Promise<AuthenticatedUser | null> {
  const { emailOrUsername, password } = credentialsSchema.parse(input)

  const loginValue = emailOrUsername.trim().toLowerCase()

  if (!process.env.PORTAL_DB_URL) {
    return process.env.NODE_ENV !== 'production'
      ? handleDevFallback(loginValue, password)
      : null
  }

  const prisma = getPortalAuthPrisma()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: loginValue },
        { username: loginValue },
      ],
      isActive: true,
    },
    select: userSelect,
  }) as (PortalUserRecord | null)

  if (!user) {
    return null
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    return null
  }

  return mapPortalUser(user)
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

  return buildDemoUser()
}

function buildDemoUser(): AuthenticatedUser {
  const demoUsername = (process.env.DEMO_ADMIN_USERNAME || DEFAULT_DEMO_USERNAME).toLowerCase()
  const entitlements: AppEntitlementMap = {
    talos: { departments: ['Ops'] },
    atlas: { departments: ['People Ops'] },
    website: { departments: [] },
    kairos: { departments: ['Product'] },
    'x-plan': { departments: ['Product'] },
  }

  return {
    id: DEMO_ADMIN_UUID,
    email: process.env.DEMO_ADMIN_EMAIL || 'dev-admin@targonglobal.com',
    username: demoUsername,
    fullName: 'Development Admin',
    roles: ['admin'],
    entitlements,
  }
}

export async function getUserEntitlements(userId: string) {
  if (!process.env.PORTAL_DB_URL) {
    return {}
  }

  const prisma = getPortalAuthPrisma()

  const assignments = await prisma.userApp.findMany({
    where: { userId },
    select: {
      departments: true,
      app: {
        select: {
          slug: true,
        },
      },
    },
  })

  const entitlements: AppEntitlementMap = {}
  for (const assignment of assignments) {
    entitlements[assignment.app.slug] = {
      departments: Array.isArray(assignment.departments) ? (assignment.departments as string[]) : [],
    }
  }

  return entitlements
}

export async function getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  if (!process.env.PORTAL_DB_URL) {
    const demoUser = buildDemoUser()
    if (demoUser.email.toLowerCase() === normalizedEmail) {
      return demoUser
    }
    return null
  }

  const prisma = getPortalAuthPrisma()
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      isActive: true,
    },
    select: userSelect,
  }) as (PortalUserRecord | null)
  if (!user) return null
  return mapPortalUser(user)
}

function mapPortalUser(user: PortalUserRecord): AuthenticatedUser {
  const entitlements = user.appAccess.reduce<AppEntitlementMap>((acc, assignment) => {
    acc[assignment.app.slug] = {
      departments: Array.isArray(assignment.departments)
        ? (assignment.departments as string[])
        : [],
    }
    return acc
  }, {} as AppEntitlementMap)

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    roles: user.roles.map((role) => role.role.name),
    entitlements,
  }
}
