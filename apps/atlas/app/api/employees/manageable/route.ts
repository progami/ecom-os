import { NextResponse } from 'next/server'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getManageableEmployees, canManageEmployee } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

/**
 * GET /api/employees/manageable
 * Returns list of employees the current user can manage (for reviews, disciplinary actions, etc.)
 */
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json(
        { error: 'Unauthorized - not logged in' },
        { status: 401 }
      )
    }

    const employees = await getManageableEmployees(currentEmployeeId)
    return NextResponse.json({ items: employees, total: employees.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch manageable employees')
  }
}

/**
 * POST /api/employees/manageable/check
 * Check if current user can manage a specific employee
 */
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json(
        { error: 'Unauthorized - not logged in' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const targetEmployeeId = body.employeeId

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: 'employeeId is required' },
        { status: 400 }
      )
    }

    const result = await canManageEmployee(currentEmployeeId, targetEmployeeId)
    return NextResponse.json(result)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to check permission')
  }
}
