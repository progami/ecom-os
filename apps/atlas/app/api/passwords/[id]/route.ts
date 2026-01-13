import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'

const PasswordCategoryEnum = z.enum([
  'SOCIAL_MEDIA',
  'CLOUD_SERVICE',
  'DEVELOPMENT',
  'FINANCE',
  'COMMUNICATION',
  'HR_SYSTEM',
  'OTHER',
])

const UpdatePasswordSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  username: z.string().max(200).trim().optional().nullable(),
  password: z.string().min(1).max(500).optional(),
  url: z.string().max(500).trim().optional().nullable(),
  category: PasswordCategoryEnum.optional(),
  notes: z.string().max(2000).trim().optional().nullable(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const password = await prisma.password.findUnique({ where: { id } })

    if (!password) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 })
    }

    return NextResponse.json(password)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch password')
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.password.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 })
    }

    const body = await req.json()
    const validation = validateBody(UpdatePasswordSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const password = await prisma.password.update({
      where: { id },
      data: {
        title: data.title,
        username: data.username,
        password: data.password,
        url: data.url,
        category: data.category,
        notes: data.notes,
      },
    })

    return NextResponse.json(password)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update password')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.password.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 })
    }

    await prisma.password.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete password')
  }
}
