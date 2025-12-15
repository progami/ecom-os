import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { calculateStanding, calculateCulturalHealth } from '@/lib/standing'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')

    // If employeeId is provided, get individual standing
    if (employeeId) {
      const standing = await calculateStanding(employeeId)
      return NextResponse.json(standing)
    }

    // Otherwise, return cultural health metrics
    const health = await calculateCulturalHealth()
    return NextResponse.json(health)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch standing data')
  }
}
