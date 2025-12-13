import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Fetch all departments with their heads and parent relationships
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        kpi: true,
        headId: true,
        parentId: true,
        head: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            avatar: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ items: departments })
  } catch (e) {
    console.error('[Departments Hierarchy] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch department hierarchy' },
      { status: 500 }
    )
  }
}
