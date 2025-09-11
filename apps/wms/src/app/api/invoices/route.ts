import { withAuth, ApiResponses } from '@/lib/api'

// Invoice model removed in v0.5.0
export const GET = withAuth(async () => {
  return ApiResponses.serverError('Invoice functionality removed in v0.5.0')
})

export const POST = withAuth(async () => {
  return ApiResponses.serverError('Invoice functionality removed in v0.5.0')
})

export const PUT = withAuth(async () => {
  return ApiResponses.serverError('Invoice functionality removed in v0.5.0')
})

export const DELETE = withAuth(async () => {
  return ApiResponses.serverError('Invoice functionality removed in v0.5.0')
})
