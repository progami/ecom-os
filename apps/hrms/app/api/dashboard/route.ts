import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET() {
  // Default fallback data when database is unavailable
  const fallbackStats = [
    { label: 'Total Employees', value: 0, trend: 'neutral' as const, change: '—' },
    { label: 'Active Policies', value: 0, trend: 'neutral' as const, change: '—' },
    { label: 'Providers', value: 0, trend: 'neutral' as const, change: '—' },
  ]

  const fallbackActivity: any[] = []
  const fallbackEvents: any[] = []

  try {
    const [employeeCount, activePolicies, providerCount] = await Promise.all([
      prisma.employee.count(),
      prisma.policy.count({ where: { status: 'ACTIVE' as any } }),
      prisma.resource.count(),
    ])

    const stats = [
      { label: 'Total Employees', value: employeeCount, trend: 'neutral' as const, change: '—' },
      { label: 'Active Policies', value: activePolicies, trend: 'neutral' as const, change: '—' },
      { label: 'Providers', value: providerCount, trend: 'neutral' as const, change: '—' },
    ]

    const recentActivity = [
      { id: 'act_1', type: 'employee', description: 'System ready', timestamp: new Date().toISOString(), status: 'completed' as const },
    ]

    const upcomingEvents: any[] = []

    return NextResponse.json({ stats, recentActivity, upcomingEvents })
  } catch (e: any) {
    // Log error server-side but return fallback data to keep UI functional
    console.error('[HRMS Dashboard] Database error:', e?.message || e)

    // Return fallback data instead of error so UI renders
    return NextResponse.json({
      stats: fallbackStats,
      recentActivity: fallbackActivity,
      upcomingEvents: fallbackEvents
    })
  }
}
