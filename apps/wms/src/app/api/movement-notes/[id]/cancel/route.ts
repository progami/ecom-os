import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { cancelMovementNote } from '@/lib/services/movement-note-service'

export const POST = withAuthAndParams(async (_request: NextRequest, params, _session) => {
  const idParam = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined
  if (!idParam) {
    return ApiResponses.badRequest('Delivery note ID is required')
  }

  await cancelMovementNote(idParam)
  return ApiResponses.noContent()
})
