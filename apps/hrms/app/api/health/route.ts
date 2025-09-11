import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const [employees, resources, policies] = await Promise.all([
      prisma.employee.count(),
      prisma.resource.count(),
      prisma.policy.count(),
    ])
    return NextResponse.json({ ok: true, employees, resources, policies })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
