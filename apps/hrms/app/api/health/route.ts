import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET() {
  try {
    const [employees, resources, policies] = await Promise.all([
      prisma.employee.count(),
      prisma.resource.count(),
      prisma.policy.count(),
    ])
    return NextResponse.json({ ok: true, employees, resources, policies })
  } catch (e) {
    // Don't expose internal error details in health check
    console.error('[HRMS Health] Database error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'DB not reachable' }, { status: 500 })
  }
}
