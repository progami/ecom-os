import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { postMovementNote } from '@/lib/services/movement-note-service'

export const POST = withAuthAndParams(async (_request: NextRequest, params, session) => {
 const idParam = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined
 if (!idParam) {
 return ApiResponses.badRequest('Delivery note ID is required')
 }

 const note = await postMovementNote(idParam, {
 id: session.user.id,
 name: session.user.name,
 })

 return ApiResponses.success(note)
})
