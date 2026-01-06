import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'
import { getManagerChain, getOrgVisibleEmployeeIds, isHROrAbove } from '@/lib/permissions'

type HierarchyEmployee = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  employmentType: string
  avatar: string | null
  reportsToId: string | null
  status: string
}

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'direct-reports'

    const user = await getCurrentUser()
    const currentEmployeeId = user?.employee?.id
    const isHR = currentEmployeeId ? await isHROrAbove(currentEmployeeId) : false

    if (type === 'direct-reports') {
      if (!currentEmployeeId) {
        return NextResponse.json({ items: [], currentEmployeeId: null })
      }

      const directReports = await prisma.employee.findMany({
        where: {
          reportsToId: currentEmployeeId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
          employmentType: true,
          avatar: true,
          reportsToId: true,
          status: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      })

      return NextResponse.json({ items: directReports, currentEmployeeId })
    }

    if (type === 'manager-chain') {
      if (!currentEmployeeId) {
        return NextResponse.json({ items: [], currentEmployeeId: null })
      }

      const chain: HierarchyEmployee[] = []
      let currentId: string | null = currentEmployeeId

      // Walk up the hierarchy to get the manager chain
      while (currentId) {
        const emp: HierarchyEmployee | null = await prisma.employee.findUnique({
          where: { id: currentId },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            position: true,
            employmentType: true,
            avatar: true,
            reportsToId: true,
            status: true,
          },
        })

        if (!emp) break

        // Skip adding the current user to the chain (we start from their manager)
        if (emp.id !== currentEmployeeId) {
          chain.push(emp)
        }

        currentId = emp.reportsToId
      }

      return NextResponse.json({ items: chain, currentEmployeeId })
    }

    if (type === 'full') {
      if (!currentEmployeeId) {
        return NextResponse.json({
          items: [],
          currentEmployeeId: null,
          managerChainIds: [],
          directReportIds: [],
        })
      }

      const visibleIds = isHR ? null : await getOrgVisibleEmployeeIds(currentEmployeeId)

      // Get all active employees (HR) or only visible slice (non-HR).
      const employees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          ...(visibleIds ? { id: { in: visibleIds } } : {}),
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
          employmentType: true,
          avatar: true,
          reportsToId: true,
          status: true,
        },
        orderBy: [{ employeeNumber: 'asc' }],
      })

      const managerChainIds = await getManagerChain(currentEmployeeId)
      const directReportIds = employees
        .filter((emp: HierarchyEmployee) => emp.reportsToId === currentEmployeeId)
        .map((emp: HierarchyEmployee) => emp.id)

      return NextResponse.json({
        items: employees,
        currentEmployeeId,
        managerChainIds,
        directReportIds,
      })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch hierarchy')
  }
}
