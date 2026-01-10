import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { S3Service } from '@targon/aws-s3'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

const TargetSchema = z.object({
  type: z.enum(['EMPLOYEE', 'CASE']),
  id: z.string().min(1).max(100),
})

const VisibilitySchema = z.enum(['HR_ONLY', 'EMPLOYEE_AND_HR', 'INTERNAL_HR'])

const PresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  target: TargetSchema,
  visibility: VisibilitySchema.optional(),
})

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()

  if (!cleaned) return 'file'
  if (cleaned.length <= 120) return cleaned

  const extMatch = cleaned.match(/(\.[a-z0-9]{1,8})$/)
  const ext = extMatch ? extMatch[1]! : ''
  const base = cleaned.slice(0, 120 - ext.length)
  return `${base}${ext}`
}

function getEnvLabel(): string {
  const vercel = process.env.VERCEL_ENV?.trim()
  if (vercel) return vercel
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

function isAllowedContentType(contentType: string): boolean {
  const allowed = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  return allowed.has(contentType.toLowerCase())
}

async function canUploadToEmployee(params: { actorId: string; employeeId: string; visibility: string | undefined }): Promise<boolean> {
  const isHR = await isHROrAbove(params.actorId)
  if (isHR) return true
  if (params.actorId !== params.employeeId) return false
  // Self upload: allow only for shared visibility.
  return params.visibility === 'EMPLOYEE_AND_HR'
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const validation = validateBody(PresignSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    if (!isAllowedContentType(data.contentType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    if (data.target.type === 'EMPLOYEE') {
      const canUpload = await canUploadToEmployee({
        actorId,
        employeeId: data.target.id,
        visibility: data.visibility,
      })
      if (!canUpload) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const exists = await prisma.employee.findUnique({ where: { id: data.target.id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    } else {
      const isHR = await isHROrAbove(actorId)
      if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const exists = await prisma.case.findUnique({ where: { id: data.target.id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const env = getEnvLabel()
    const id = randomUUID()
    const safeFilename = sanitizeFilename(data.filename)
    const entity = data.target.type.toLowerCase()
    const key = `atlas/${env}/${entity}/${data.target.id}/${id}-${safeFilename}`

    const s3 = new S3Service()
    const putUrl = await s3.getPresignedUrl(key, 'put', {
      contentType: data.contentType,
      expiresIn: 15 * 60,
    })

    return NextResponse.json({ putUrl, key })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create upload URL')
  }
}

