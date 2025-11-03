import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses } from '@/lib/api'

export const POST = withAuthAndParams(async (_request: NextRequest, params, _session) => {
 const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
 if (!id) {
 return ApiResponses.badRequest('Purchase order ID is required')
 }

 return ApiResponses.conflict('Purchase orders must be fulfilled via movement notes. Create a movement note instead of posting directly.')
})
