import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'

type PolicyRouteContext = { params: Promise<{ id: string }> }

function mapEmployeeRegionToPolicyRegion(region: string): 'KANSAS_US' | 'PAKISTAN' | null {
  if (region === 'PAKISTAN') return 'PAKISTAN'
  if (region === 'KANSAS_USA') return 'KANSAS_US'
  return null
}

export async function GET(req: Request, context: PolicyRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const employeeId = await getCurrentEmployeeId()
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [policy, employee] = await Promise.all([
      prisma.policy.findUnique({
        where: { id },
        select: { id: true, version: true, status: true, region: true },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { region: true },
      }),
    ])

    if (!policy) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const mappedRegion = mapEmployeeRegionToPolicyRegion(employee.region)
    const isApplicable =
      policy.region === 'ALL' || (mappedRegion !== null && policy.region === mappedRegion)

    const ack = await prisma.policyAcknowledgement.findUnique({
      where: {
        policyId_employeeId_policyVersion: {
          policyId: policy.id,
          employeeId,
          policyVersion: policy.version,
        },
      },
      select: {
        id: true,
        acknowledgedAt: true,
      },
    })

    return NextResponse.json({
      policyId: policy.id,
      policyVersion: policy.version,
      policyStatus: policy.status,
      isApplicable,
      isAcknowledged: Boolean(ack),
      acknowledgedAt: ack?.acknowledgedAt ?? null,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch acknowledgement status')
  }
}

export async function POST(req: Request, context: PolicyRouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const employeeId = await getCurrentEmployeeId()
    if (!employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [policy, employee] = await Promise.all([
      prisma.policy.findUnique({
        where: { id },
        select: { id: true, version: true, status: true, region: true, title: true },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { region: true },
      }),
    ])

    if (!policy) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (policy.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only active policies can be acknowledged' }, { status: 400 })
    }

    const mappedRegion = mapEmployeeRegionToPolicyRegion(employee.region)
    const isApplicable =
      policy.region === 'ALL' || (mappedRegion !== null && policy.region === mappedRegion)

    if (!isApplicable) {
      return NextResponse.json({ error: 'Policy is not applicable to your region' }, { status: 400 })
    }

    const ack = await prisma.policyAcknowledgement.upsert({
      where: {
        policyId_employeeId_policyVersion: {
          policyId: policy.id,
          employeeId,
          policyVersion: policy.version,
        },
      },
      create: {
        policyId: policy.id,
        employeeId,
        policyVersion: policy.version,
      },
      update: {},
    })

    return NextResponse.json({
      id: ack.id,
      policyId: ack.policyId,
      employeeId: ack.employeeId,
      policyVersion: ack.policyVersion,
      acknowledgedAt: ack.acknowledgedAt,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to acknowledge policy')
  }
}

