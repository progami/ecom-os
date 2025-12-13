import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
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

    const projects = await projectModel.findMany({
      include: {
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
    console.error('[Projects] Error:', e)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    // Check if the project model exists (migration may not have been run yet)
    const projectModel = (prisma as any).project
    if (!projectModel) {
      return NextResponse.json({ error: 'Projects feature not available. Please run database migration.' }, { status: 503 })
    }

    const body = await req.json()
    const { name, code, description, status, leadId, startDate, endDate } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const project = await projectModel.create({
      data: {
        name,
        code: code || null,
        description: description || null,
        status: status || 'ACTIVE',
        leadId: leadId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Project name already exists' }, { status: 400 })
    }
    if (e.code === 'P2021' || e.message?.includes('does not exist')) {
      return NextResponse.json({ error: 'Projects feature not available. Please run database migration.' }, { status: 503 })
    }
    console.error('[Projects] Error:', e)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
