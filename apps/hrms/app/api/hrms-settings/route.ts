import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { getHrmsSettings } from '@/lib/domain/checklists/checklist-service'

const UpdateSettingsSchema = z.object({
  defaultHROwnerId: z.string().min(1).max(100).optional().nullable(),
  defaultITOwnerId: z.string().min(1).max(100).optional().nullable(),
})

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const settings = await getHrmsSettings()
    const [defaultHROwner, defaultITOwner] = await Promise.all([
      settings.defaultHROwnerId
        ? prisma.employee.findUnique({
            where: { id: settings.defaultHROwnerId },
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          })
        : null,
      settings.defaultITOwnerId
        ? prisma.employee.findUnique({
            where: { id: settings.defaultITOwnerId },
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          })
        : null,
    ])

    return NextResponse.json({
      ...settings,
      defaultHROwner,
      defaultITOwner,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch HRMS settings')
  }
}

export async function PATCH(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const validation = validateBody(UpdateSettingsSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const row = await prisma.hrmsSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        defaultHROwnerId: data.defaultHROwnerId ?? null,
        defaultITOwnerId: data.defaultITOwnerId ?? null,
      },
      update: {
        ...(data.defaultHROwnerId !== undefined ? { defaultHROwnerId: data.defaultHROwnerId } : {}),
        ...(data.defaultITOwnerId !== undefined ? { defaultITOwnerId: data.defaultITOwnerId } : {}),
      },
      select: { defaultHROwnerId: true, defaultITOwnerId: true },
    })

    return NextResponse.json({
      defaultHROwnerId: row.defaultHROwnerId ?? null,
      defaultITOwnerId: row.defaultITOwnerId ?? null,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update HRMS settings')
  }
}

