import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { S3Service } from '@ecom-os/aws-s3'

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> }

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function contentDisposition(filename: string | null | undefined): string | undefined {
  if (!filename) return undefined
  const safe = filename.replaceAll('"', "'")
  return `attachment; filename="${safe}"`
}

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id, attachmentId } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    if (!attachmentId || attachmentId.length > 100) return NextResponse.json({ error: 'Invalid attachment id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [isHR, base] = await Promise.all([
      isHROrAbove(actorId),
      prisma.case.findUnique({
        where: { id },
        select: {
          id: true,
          createdById: true,
          assignedToId: true,
          subjectEmployeeId: true,
          participants: { select: { employeeId: true } },
        },
      }),
    ])

    if (!base) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!isHR) {
      if (base.createdById !== actorId && base.assignedToId !== actorId && !base.participants.some((p) => p.employeeId === actorId)) {
        let isMgr = false
        if (base.subjectEmployeeId) {
          isMgr = await isManagerOf(actorId, base.subjectEmployeeId)
        }
        if (!isMgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const attachment = await prisma.caseAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, caseId: true, fileUrl: true, fileName: true, visibility: true },
    })

    if (!attachment || attachment.caseId !== base.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!isHR) {
      // Visibility gating for non-HR viewers
      if (attachment.visibility === 'INTERNAL_HR') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (attachment.visibility === 'EMPLOYEE_VISIBLE' && base.subjectEmployeeId && actorId !== base.subjectEmployeeId) {
        const isMgr = await isManagerOf(actorId, base.subjectEmployeeId)
        if (!isMgr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (looksLikeUrl(attachment.fileUrl)) {
      return NextResponse.json({ url: attachment.fileUrl })
    }

    const s3 = new S3Service()
    const url = await s3.getPresignedUrl(attachment.fileUrl, 'get', {
      expiresIn: 10 * 60,
      responseContentDisposition: contentDisposition(attachment.fileName),
    })

    return NextResponse.json({ url })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to generate download link')
  }
}

