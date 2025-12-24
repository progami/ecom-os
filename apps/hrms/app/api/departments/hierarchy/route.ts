import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'

// Departments to exclude from the organogram hierarchy view
const EXCLUDED_DEPARTMENTS = ['executive supervision', 'general']

// Only show these employment types in the "By Department" view
const VISIBLE_EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME'] as const

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
            employmentType: true,
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
	          where: {
	            employmentType: { in: ['FULL_TIME', 'PART_TIME'] },
	          },
	          select: {
	            id: true,
	            employeeId: true,
	            firstName: true,
	            lastName: true,
	            position: true,
	            employmentType: true,
	            avatar: true,
	          },
	          orderBy: { firstName: 'asc' },
	        },
        _count: {
          select: {
            employees: {
              where: {
                employmentType: { in: ['FULL_TIME', 'PART_TIME'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Filter out heads who are not FULL_TIME or PART_TIME
    const filtered = departments.map(dept => ({
      ...dept,
      head: dept.head && VISIBLE_EMPLOYMENT_TYPES.includes(dept.head.employmentType as any)
        ? dept.head
        : null,
      headId: dept.head && VISIBLE_EMPLOYMENT_TYPES.includes(dept.head.employmentType as any)
        ? dept.headId
        : null,
    }))

    return NextResponse.json({ items: filtered })
  } catch (e) {
    console.error('[Departments Hierarchy] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch department hierarchy' },
      { status: 500 }
    )
  }
}
