import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const departments = await prisma.department.findMany({
      include: {
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            position: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            employees: true,
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ items: departments })
  } catch (e) {
    console.error('[Departments] Error:', e)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()
    const { name, code, kpi, headId, parentId } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const department = await prisma.department.create({
      data: {
        name,
        code: code || null,
        kpi: kpi || null,
        headId: headId || null,
        parentId: parentId || null,
      },
      include: {
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(department, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 400 })
    }
    console.error('[Departments] Error:', e)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
