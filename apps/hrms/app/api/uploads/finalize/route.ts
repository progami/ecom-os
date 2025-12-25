import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeFileVisibility } from '@/lib/hrms-prisma-types'

const TargetSchema = z.object({
  type: z.enum(['EMPLOYEE', 'CASE']),
  id: z.string().min(1).max(100),
})

const VisibilitySchema = z.enum(['HR_ONLY', 'EMPLOYEE_AND_HR', 'INTERNAL_HR'])

const FinalizeSchema = z.object({
  key: z.string().min(10).max(1000),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  target: TargetSchema,
  visibility: VisibilitySchema.optional(),
  title: z.string().max(200).optional().nullable(),
})

function keyMatchesTarget(params: { key: string; targetType: 'EMPLOYEE' | 'CASE'; targetId: string }): boolean {
  const entity = params.targetType.toLowerCase()
  const pattern = new RegExp(`^hrms\\/[^/]+\\/${entity}\\/${params.targetId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\/`)
  return pattern.test(params.key)
}

function employeeVisibilityFromInput(input: string | undefined): EmployeeFileVisibility {
  if (input === 'EMPLOYEE_AND_HR') return 'EMPLOYEE_AND_HR'
  return 'HR_ONLY'
}

async function canUploadToEmployee(params: { actorId: string; employeeId: string; visibility: string | undefined }): Promise<boolean> {
  const isHR = await isHROrAbove(params.actorId)
  if (isHR) return true
  if (params.actorId !== params.employeeId) return false
  return params.visibility === 'EMPLOYEE_AND_HR'
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const validation = validateBody(FinalizeSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    if (!keyMatchesTarget({ key: data.key, targetType: data.target.type, targetId: data.target.id })) {
      return NextResponse.json({ error: 'Invalid upload key for target' }, { status: 400 })
    }

    if (data.target.type === 'EMPLOYEE') {
      const canUpload = await canUploadToEmployee({ actorId, employeeId: data.target.id, visibility: data.visibility })
      if (!canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const employee = await prisma.employee.findUnique({ where: { id: data.target.id }, select: { id: true } })
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

      const title = (data.title ?? '').trim() || data.filename
      const visibility = employeeVisibilityFromInput(data.visibility)

      const created = await prisma.employeeFile.create({
        data: {
          employeeId: data.target.id,
          title,
          fileUrl: data.key,
          fileName: data.filename,
          contentType: data.contentType,
          size: data.size,
          visibility,
          uploadedById: actorId,
        },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await writeAuditLog({
        actorId,
        action: 'ATTACH',
        entityType: 'EMPLOYEE_FILE',
        entityId: created.id,
        summary: 'Added employee document',
        metadata: {
          employeeId: data.target.id,
          key: data.key,
          contentType: data.contentType,
          size: data.size,
          visibility,
        },
        req,
      })

      // Notify the employee only if the document is visible to them.
      if (visibility === 'EMPLOYEE_AND_HR' && actorId !== data.target.id) {
        await prisma.notification.create({
          data: {
            type: 'SYSTEM',
            title: 'New document added to your profile',
            message: 'A new document is available in your HRMS profile.',
            link: `/employees/${data.target.id}?tab=documents`,
            employeeId: data.target.id,
            relatedId: created.id,
            relatedType: 'EMPLOYEE',
          },
        })
      }

      return NextResponse.json(
        {
          id: created.id,
          title: created.title,
          fileName: created.fileName,
          contentType: created.contentType,
          size: created.size,
          visibility: created.visibility,
          uploadedAt: created.uploadedAt,
          uploadedBy: created.uploadedBy,
        },
        { status: 201 }
      )
    }

    // CASE
    const isHR = await isHROrAbove(actorId)
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const baseCase = await prisma.case.findUnique({ where: { id: data.target.id }, select: { id: true } })
    if (!baseCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    const title = (data.title ?? '').trim() || data.filename
    const visibility = data.visibility === 'EMPLOYEE_AND_HR' ? 'EMPLOYEE_VISIBLE' : 'INTERNAL_HR'

    const created = await prisma.caseAttachment.create({
      data: {
        caseId: data.target.id,
        uploadedById: actorId,
        title,
        fileUrl: data.key,
        fileName: data.filename,
        contentType: data.contentType,
        size: data.size,
        visibility,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    })

    await writeAuditLog({
      actorId,
      action: 'ATTACH',
      entityType: 'CASE_ATTACHMENT',
      entityId: created.id,
      summary: 'Added case attachment',
      metadata: {
        caseId: data.target.id,
        key: data.key,
        contentType: data.contentType,
        size: data.size,
        visibility,
      },
      req,
    })

    return NextResponse.json(
      {
        id: created.id,
        title: created.title,
        fileName: created.fileName,
        contentType: created.contentType,
        size: created.size,
        visibility: created.visibility,
        createdAt: created.createdAt,
        uploadedBy: created.uploadedBy,
      },
      { status: 201 }
    )
  } catch (e) {
    return safeErrorResponse(e, 'Failed to finalize upload')
  }
}
