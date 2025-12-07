import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  // Default fallback data when database is unavailable
  const fallbackStats = [
    { label: 'Total Employees', value: 0, trend: 'neutral' as const, change: '—' },
    { label: 'Active Policies', value: 0, trend: 'neutral' as const, change: '—' },
    { label: 'Providers', value: 0, trend: 'neutral' as const, change: '—' },
  ]

  const fallbackActivity: unknown[] = []
  const fallbackEvents: unknown[] = []

  try {
    const [employeeCount, activePolicies, providerCount] = await Promise.all([
      prisma.employee.count(),
      prisma.policy.count({ where: { status: 'ACTIVE' } }),
      prisma.resource.count(),
    ])

    const stats = [
      { label: 'Total Employees', value: employeeCount, trend: 'neutral' as const, change: '—' },
      { label: 'Active Policies', value: activePolicies, trend: 'neutral' as const, change: '—' },
      { label: 'Providers', value: providerCount, trend: 'neutral' as const, change: '—' },
    ]

    const recentActivity = [
      {
        id: 'act_1',
        type: 'employee',
        description: 'System ready',
        timestamp: new Date().toISOString(),
        status: 'completed' as const,
      },
    ]

    const upcomingEvents: unknown[] = []

    return NextResponse.json({ stats, recentActivity, upcomingEvents })
  } catch (e) {
    // Log error server-side but return fallback data to keep UI functional
    console.error('[HRMS Dashboard] Database error:', e instanceof Error ? e.message : e)

    // Return fallback data instead of error so UI renders
    return NextResponse.json({
      stats: fallbackStats,
      recentActivity: fallbackActivity,
      upcomingEvents: fallbackEvents,
    })
  }
}
