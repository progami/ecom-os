import 'server-only'

import type { Session } from 'next-auth'
import { getPortalAuthPrisma } from '@ecom-os/auth/server'
import prisma from '@/lib/prisma'

type StrategyActor = {
  id: string | null
  email: string | null
  isSuperAdmin: boolean
}

export type AllowedAssignee = {
  id: string
  email: string
  fullName: string | null
}

function parseEmailSet(raw: string | undefined) {
  return new Set(
    (raw ?? '')
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

const DEFAULT_SUPER_ADMINS = new Set(['jarrar@targonglobal.com'])

function superAdminEmailSet() {
  const configured = parseEmailSet(process.env.XPLAN_SUPER_ADMIN_EMAILS)
  return configured.size > 0 ? configured : DEFAULT_SUPER_ADMINS
}

export function isXPlanSuperAdmin(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return false
  return superAdminEmailSet().has(normalized)
}

export function getStrategyActor(session: Session | null): StrategyActor {
  const user = session?.user as (Session['user'] & { id?: unknown }) | undefined
  const id = typeof user?.id === 'string' ? user.id : null
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : null

  return {
    id,
    email,
    isSuperAdmin: isXPlanSuperAdmin(email),
  }
}

export function buildStrategyAccessWhere(actor: StrategyActor) {
  if (actor.isSuperAdmin) return {}

  const or: Array<Record<string, unknown>> = []
  if (actor.id) {
    or.push({ createdById: actor.id }, { assigneeId: actor.id })
  }
  if (actor.email) {
    or.push({ createdByEmail: actor.email }, { assigneeEmail: actor.email })
  }

  if (or.length === 0) {
    return { id: '__forbidden__' }
  }

  return { OR: or }
}

export async function canAccessStrategy(strategyId: string, actor: StrategyActor): Promise<boolean> {
  if (actor.isSuperAdmin) return true
  if (!strategyId) return false

  const prismaAny = prisma as unknown as Record<string, any>
  const row = await prismaAny.strategy.findFirst({
    where: {
      id: strategyId,
      ...buildStrategyAccessWhere(actor),
    },
    select: { id: true },
  })

  return Boolean(row)
}

export async function requireStrategyAccess(strategyId: string, actor: StrategyActor): Promise<void> {
  const ok = await canAccessStrategy(strategyId, actor)
  if (!ok) {
    throw new Error('StrategyAccessDenied')
  }
}

export async function listAllowedXPlanAssignees(): Promise<AllowedAssignee[]> {
  if (!process.env.PORTAL_DB_URL) {
    return []
  }

  const authPrisma = getPortalAuthPrisma()
  const users = await authPrisma.user.findMany({
    where: {
      isActive: true,
      appAccess: {
        some: {
          app: { slug: 'x-plan' },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { email: 'asc' },
  })

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
  }))
}

export async function resolveAllowedXPlanAssigneeById(id: string): Promise<AllowedAssignee | null> {
  if (!process.env.PORTAL_DB_URL) {
    return null
  }

  const authPrisma = getPortalAuthPrisma()
  const user = await authPrisma.user.findFirst({
    where: {
      id,
      isActive: true,
      appAccess: {
        some: {
          app: { slug: 'x-plan' },
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
  }
}

