import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { getHREmployees, getSuperAdminEmployees } from '@/lib/permissions'
import { safeErrorResponse, validateBody, withRateLimit } from '@/lib/api-helpers'

const CreateAccessRequestSchema = z.object({
  reason: z.string().max(100).optional(),
  note: z.string().max(2000).optional(),
})

function formatName(firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.trim()
  return name || 'Employee'
}

async function findExistingOpenRequest(employeeId: string): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  return prisma.task.findFirst({
    where: {
      createdById: employeeId,
      title: { in: ['HRMS access request', 'Atlas access request'] },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      createdAt: { gte: since },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.session) {
      return NextResponse.json({ email: null, name: null }, { status: 200 })
    }
    return NextResponse.json({
      email: currentUser.session.email ?? null,
      name: currentUser.session.name ?? null,
    })
  } catch {
    return NextResponse.json({ email: null, name: null }, { status: 200 })
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.session?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const employee = currentUser.employee
    if (!employee) {
      return NextResponse.json(
        { error: 'Your employee profile is still being set up. Please retry in a moment.' },
        { status: 409 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const validation = validateBody(CreateAccessRequestSchema, body)
    if (!validation.success) return validation.error

    const existing = await findExistingOpenRequest(employee.id)
    if (existing) {
      return NextResponse.json({ ok: true, alreadyRequested: true, requestTaskId: existing.id })
    }

    const [hrEmployees, superAdmins] = await Promise.all([getHREmployees(), getSuperAdminEmployees()])
    const recipients = hrEmployees.length > 0 ? hrEmployees : superAdmins
    const assigneeId = recipients[0]?.id ?? null

    const reason = validation.data.reason?.trim() || 'Atlas access request'
    const note = validation.data.note?.trim() || null
    const requesterName = formatName(employee.firstName, employee.lastName)

    const task = await prisma.task.create({
      data: {
        title: 'Atlas access request',
        description: [
          `Requester: ${requesterName}`,
          `Email: ${employee.email}`,
          `Employee ID: ${employee.employeeId}`,
          `Reason: ${reason}`,
          note ? `Note: ${note}` : null,
          '',
          'Next steps:',
          '- Confirm the user should have Atlas entitlement in the Portal.',
          '- If approved, grant Atlas access and assign appropriate Atlas roles.',
        ]
          .filter(Boolean)
          .join('\n'),
        category: 'GENERAL',
        status: 'OPEN',
        dueDate: new Date(Date.now() + 48 * 60 * 60_000),
        createdById: employee.id,
        assignedToId: assigneeId,
        subjectEmployeeId: employee.id,
      },
      select: { id: true },
    })

    if (recipients.length > 0) {
      const title = 'Access requested'
      const existingNotifications = await prisma.notification.findMany({
        where: {
          employeeId: { in: recipients.map((r) => r.id) },
          title,
          relatedType: 'TASK',
          relatedId: task.id,
          createdAt: { gte: new Date(Date.now() - 12 * 60 * 60_000) },
        },
        select: { employeeId: true },
      })
      const existingByEmployee = new Set(existingNotifications.map((n) => n.employeeId))

      for (const r of recipients) {
        if (existingByEmployee.has(r.id)) continue
        // Use create (not createMany) so Prisma hooks can enqueue notification email dispatches.
        await prisma.notification.create({
          data: {
            type: 'SYSTEM',
            title,
            message: `${requesterName} requested Atlas access.`,
            link: '/admin/access',
            employeeId: r.id,
            relatedType: 'TASK',
            relatedId: task.id,
          },
        })
      }
    }

    return NextResponse.json({ ok: true, requestTaskId: task.id })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to request access')
  }
}
