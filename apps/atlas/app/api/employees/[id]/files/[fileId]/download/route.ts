import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'
import { S3Service } from '@ecom-os/aws-s3'

type RouteContext = { params: Promise<{ id: string; fileId: string }> }

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
    const { id, fileId } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    if (!fileId || fileId.length > 100) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [isHR, baseEmployee] = await Promise.all([
      isHROrAbove(actorId),
      prisma.employee.findFirst({
        where: { OR: [{ id }, { employeeId: id }] },
        select: { id: true },
      }),
    ])

    if (!baseEmployee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isSelf = actorId === baseEmployee.id
    if (!isHR && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const file = await prisma.employeeFile.findUnique({
      where: { id: fileId },
      select: { id: true, employeeId: true, fileUrl: true, fileName: true, visibility: true },
    })

    if (!file || file.employeeId !== baseEmployee.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (isSelf && file.visibility !== 'EMPLOYEE_AND_HR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (looksLikeUrl(file.fileUrl)) {
      return NextResponse.json({ url: file.fileUrl })
    }

    const s3 = new S3Service()
    const url = await s3.getPresignedUrl(file.fileUrl, 'get', {
      expiresIn: 10 * 60,
      responseContentDisposition: contentDisposition(file.fileName),
    })

    return NextResponse.json({ url })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to generate download link')
  }
}

