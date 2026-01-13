import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'

const PasswordDepartmentEnum = z.enum([
  'OPS',
  'SALES_MARKETING',
  'LEGAL',
  'HR',
  'FINANCE',
])

const CreatePasswordSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  username: z.string().max(200).trim().optional().nullable(),
  password: z.string().min(1).max(500),
  url: z.string().max(500).trim().optional().nullable(),
  department: PasswordDepartmentEnum.optional(),
  notes: z.string().max(2000).trim().optional().nullable(),
})

const UpdatePasswordSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  username: z.string().max(200).trim().optional().nullable(),
  password: z.string().min(1).max(500).optional(),
  url: z.string().max(500).trim().optional().nullable(),
  department: PasswordDepartmentEnum.optional(),
  notes: z.string().max(2000).trim().optional().nullable(),
})

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const takeRaw = searchParams.get('take')
    const skipRaw = searchParams.get('skip')
    const departmentRaw = searchParams.get('department')
    const q = searchParams.get('q')

    const take = Math.min(parseInt(takeRaw ?? '50', 10), 100)
    const skip = parseInt(skipRaw ?? '0', 10)

    const where: any = {}

    if (departmentRaw) {
      const parsed = PasswordDepartmentEnum.safeParse(departmentRaw.toUpperCase())
      if (parsed.success) where.department = parsed.data
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { url: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.password.findMany({
        where,
        take,
        skip,
        orderBy: [{ title: 'asc' }],
      }),
      prisma.password.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch passwords')
  }
}

export async function POST(req: Request) {
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

    const body = await req.json()
    const validation = validateBody(CreatePasswordSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const password = await prisma.password.create({
      data: {
        title: data.title,
        username: data.username ?? null,
        password: data.password,
        url: data.url ?? null,
        department: data.department ?? 'OPS',
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json(password, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create password')
  }
}
