import { prisma } from '@/lib/prisma'
import { getHREmployees, getSuperAdminEmployees } from '@/lib/permissions'

function toCaseSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (severity) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'MAJOR':
      return 'HIGH'
    case 'MODERATE':
      return 'MEDIUM'
    case 'MINOR':
    default:
      return 'LOW'
  }
}

export async function backfillDisciplinaryCases(options?: { take?: number }): Promise<{
  scanned: number
  linked: number
  skipped: number
}> {
  const take = options?.take ?? 50

  const missing = await prisma.disciplinaryAction.findMany({
    where: { caseId: null },
    orderBy: [{ reportedDate: 'desc' }, { createdAt: 'desc' }],
    take,
    select: {
      id: true,
      employeeId: true,
      severity: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })

  if (missing.length === 0) return { scanned: 0, linked: 0, skipped: 0 }

  const ids = missing.map((a) => a.id)
  const createLogs = await prisma.auditLog.findMany({
    where: {
      entityType: 'DISCIPLINARY_ACTION',
      action: 'CREATE',
      entityId: { in: ids },
      actorId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { entityId: true, actorId: true },
  })

  const actorByDisciplinaryId = new Map<string, string>()
  for (const log of createLogs) {
    if (!log.actorId) continue
    if (!actorByDisciplinaryId.has(log.entityId)) {
      actorByDisciplinaryId.set(log.entityId, log.actorId)
    }
  }

  const [hrEmployees, superAdmins] = await Promise.all([getHREmployees(), getSuperAdminEmployees()])
  const assigneeId = hrEmployees[0]?.id ?? superAdmins[0]?.id ?? null
  const fallbackCreatorId = assigneeId

  let linked = 0
  let skipped = 0

  for (const action of missing) {
    const creatorId = actorByDisciplinaryId.get(action.id) ?? fallbackCreatorId
    if (!creatorId) {
      skipped += 1
      continue
    }

    const title = `Violation • ${action.employee.firstName} ${action.employee.lastName}`.trim()

    await prisma.$transaction(async (tx) => {
      const caseRecord = await tx.case.create({
        data: {
          caseType: 'VIOLATION',
          title,
          description: `Backfilled from existing violation record (${action.id}).`,
          severity: toCaseSeverity(action.severity),
          subjectEmployeeId: action.employeeId,
          createdById: creatorId,
          assignedToId: assigneeId,
        },
        select: { id: true },
      })

      await tx.caseParticipant.createMany({
        data: [
          { caseId: caseRecord.id, employeeId: action.employeeId, role: 'SUBJECT' },
          { caseId: caseRecord.id, employeeId: creatorId, role: 'REPORTER' },
        ],
        skipDuplicates: true,
      })

      await tx.disciplinaryAction.update({
        where: { id: action.id },
        data: { caseId: caseRecord.id },
      })
    })

    linked += 1
  }

  return { scanned: missing.length, linked, skipped }
}

