import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'

// Departments to exclude from the organogram hierarchy view
const EXCLUDED_DEPARTMENTS = ['executive supervision', 'general']

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Fetch all departments with their heads and parent relationships
    // Exclude administrative/placeholder departments from the hierarchy
    const departments = await prisma.department.findMany({
      where: {
        NOT: {
          name: {
            in: EXCLUDED_DEPARTMENTS,
            mode: 'insensitive',
          },
        },
      },
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
          where: {
            NOT: {
              name: {
                in: EXCLUDED_DEPARTMENTS,
                mode: 'insensitive',
              },
            },
          },
          select: {
            id: true,
            name: true,
          },
        },
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            position: true,
            avatar: true,
          },
          orderBy: { firstName: 'asc' },
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
