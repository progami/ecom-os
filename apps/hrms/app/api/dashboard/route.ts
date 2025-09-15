import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET() {
  try {
    const [employeeCount, activePolicies, providerCount] = await Promise.all([
      prisma.employee.count(),
      prisma.policy.count({ where: { status: 'ACTIVE' as any } }),
      prisma.resource.count(),
    ])

    const stats = [
      { label: 'Total Employees', value: employeeCount, trend: 'neutral', change: '—' },
      { label: 'Active Policies', value: activePolicies, trend: 'neutral', change: '—' },
      { label: 'Providers', value: providerCount, trend: 'neutral', change: '—' },
    ]

    const recentActivity = [
      { id: 'act_1', type: 'employee', description: 'Employee imported: EMP1001', timestamp: new Date().toISOString(), status: 'completed' },
    ]

    const upcomingEvents = [
      { id: 'evt_1', title: 'Performance review cycle', date: new Date(Date.now()+7*24*60*60*1000).toISOString(), type: 'hr' },
    ]

    return NextResponse.json({ stats, recentActivity, upcomingEvents })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load dashboard' }, { status: 500 })
  }
}
