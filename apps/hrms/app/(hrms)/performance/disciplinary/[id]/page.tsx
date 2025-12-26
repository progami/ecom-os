import { redirect } from 'next/navigation'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getHREmployees } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

export default async function DisciplinaryDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || id.length > 100) {
    redirect('/cases?caseType=VIOLATION')
  }

  const record = await prisma.disciplinaryAction.findUnique({
    where: { id },
    select: {
      id: true,
      caseId: true,
      employeeId: true,
      severity: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })

  if (!record) {
    redirect('/cases?caseType=VIOLATION')
  }

  if (record.caseId) {
    redirect(`/cases/${record.caseId}`)
  }

  const actorId = await getCurrentEmployeeId()
  if (!actorId) {
    redirect('/cases?caseType=VIOLATION')
  }

  const hrEmployees = await getHREmployees()
  const assignedToId = hrEmployees[0]?.id ?? null
  const employeeName = `${record.employee.firstName ?? ''} ${record.employee.lastName ?? ''}`.trim()

  const { caseId } = await prisma.$transaction(async (tx) => {
    const createdCase = await tx.case.create({
      data: {
        caseType: 'VIOLATION',
        title: employeeName ? `Violation • ${employeeName}` : `Violation • ${record.employeeId}`,
        description: 'Violation record created. Use the linked violation workflow to review and proceed.',
        severity: toCaseSeverity(record.severity),
        subjectEmployeeId: record.employeeId,
        createdById: actorId,
        assignedToId,
      },
      select: { id: true, caseNumber: true },
    })

    await tx.caseParticipant.createMany({
      data: [
        { caseId: createdCase.id, employeeId: record.employeeId, role: 'SUBJECT' },
        { caseId: createdCase.id, employeeId: actorId, role: 'REPORTER' },
      ],
      skipDuplicates: true,
    })

    await tx.disciplinaryAction.update({
      where: { id: record.id },
      data: { caseId: createdCase.id },
      select: { id: true },
    })

    await writeAuditLog({
      actorId,
      action: 'CREATE',
      entityType: 'CASE',
      entityId: createdCase.id,
      summary: `Backfilled violation case #${createdCase.caseNumber}`,
      metadata: { caseType: 'VIOLATION', disciplinaryActionId: record.id },
      client: tx,
    })

    await writeAuditLog({
      actorId,
      action: 'UPDATE',
      entityType: 'DISCIPLINARY_ACTION',
      entityId: record.id,
      summary: `Linked disciplinary action to case #${createdCase.caseNumber}`,
      metadata: { caseId: createdCase.id },
      client: tx,
    })

    return { caseId: createdCase.id }
  })

  redirect(`/cases/${caseId}`)
}
