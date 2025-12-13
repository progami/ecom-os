import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Check if the project model exists (migration may not have been run yet)
    const projectModel = (prisma as any).project
    if (!projectModel) {
      return NextResponse.json({ items: [] })
    }

    // Fetch all projects with their leads and member details
    const projects = await projectModel.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'PLANNING'],
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        status: true,
        leadId: true,
        startDate: true,
        endDate: true,
        lead: {
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
        members: {
          select: {
            id: true,
            role: true,
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                position: true,
                department: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ items: projects })
  } catch (e: any) {
    // Handle case where Project table doesn't exist yet
    if (e.code === 'P2021' || e.message?.includes('does not exist')) {
      return NextResponse.json({ items: [] })
    }
    console.error('[Projects Hierarchy] Error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch project hierarchy' },
      { status: 500 }
    )
  }
}
