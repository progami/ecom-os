import type {
  AuditAction,
  AuditEntityType,
  Prisma,
  PrismaClient,
} from '@ecom-os/prisma-hrms'

import { prisma } from '@/lib/prisma'

type AuditDbClient = PrismaClient | Prisma.TransactionClient

export type AuditLogInput = {
  actorId: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  summary?: string | null
  metadata?: Prisma.InputJsonValue | null
  req?: Request
  client?: AuditDbClient
}

function getForwardedIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return null

  const first = forwarded.split(',')[0]
  if (!first) return null

  const trimmed = first.trim()
  if (!trimmed) return null

  return trimmed
}

function getUserAgent(req: Request): string | null {
  const userAgent = req.headers.get('user-agent')
  if (!userAgent) return null

  const trimmed = userAgent.trim()
  if (!trimmed) return null

  return trimmed
}

export function getAuditRequestContext(req?: Request): { ip: string | null; userAgent: string | null } {
  if (!req) return { ip: null, userAgent: null }

  return {
    ip: getForwardedIp(req),
    userAgent: getUserAgent(req),
  }
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const { ip, userAgent } = getAuditRequestContext(input.req)

  let client: AuditDbClient = prisma
  if (input.client) {
    client = input.client
  }

  try {
    await client.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary ?? null,
        metadata: input.metadata ?? undefined,
        ip,
        userAgent,
      },
    })
  } catch (e) {
    console.error('[AuditLog] Failed to write audit log:', e)
  }
}
