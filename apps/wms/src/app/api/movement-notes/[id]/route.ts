import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getMovementNoteById } from '@/lib/services/movement-note-service'

export const GET = withAuthAndParams(async (_request, params, _session) => {
  const idParam = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined
  if (!idParam) {
    return ApiResponses.badRequest('Delivery note ID is required')
  }

  const note = await getMovementNoteById(idParam)
  return ApiResponses.success(note)
})
