import { withAuth, ApiResponses } from '@/lib/api'
import { getInboundShipments } from '@/lib/amazon/client'
import { getCurrentTenantCode } from '@/lib/tenant/server'

export const GET = withAuth(async (_request, _session) => {
  try {
    const tenantCode = await getCurrentTenantCode()
    const shipmentsById = new Map<string, unknown>()
    const unkeyedShipments: unknown[] = []
    const seenTokens = new Set<string>()
    let nextToken: string | null = null
    let page = 0
    const maxPages = 12

    const getShipmentId = (shipment: unknown) => {
      if (!shipment || typeof shipment !== 'object') return null
      const record = shipment as Record<string, unknown>
      const candidate = record.ShipmentId ?? record.shipmentId ?? record.id
      if (typeof candidate !== 'string') return null
      const trimmed = candidate.trim()
      return trimmed.length > 0 ? trimmed : null
    }

    do {
      const response = await getInboundShipments(
        tenantCode ?? undefined,
        nextToken ? { nextToken } : undefined
      )
      const responseRecord =
        response && typeof response === 'object' ? (response as Record<string, unknown>) : null
      const payload =
        responseRecord && typeof responseRecord.payload === 'object'
          ? (responseRecord.payload as Record<string, unknown>)
          : responseRecord

      const pageShipments = Array.isArray(payload?.ShipmentData)
        ? payload.ShipmentData
        : Array.isArray(payload?.shipmentData)
          ? payload.shipmentData
          : Array.isArray(payload?.shipments)
            ? payload.shipments
            : []

      for (const shipment of pageShipments) {
        const shipmentId = getShipmentId(shipment)
        if (!shipmentId) {
          unkeyedShipments.push(shipment)
          continue
        }
        if (!shipmentsById.has(shipmentId)) {
          shipmentsById.set(shipmentId, shipment)
        }
      }

      const tokenCandidate =
        typeof payload?.NextToken === 'string'
          ? payload.NextToken
          : typeof payload?.nextToken === 'string'
            ? payload.nextToken
            : null

      const normalizedToken = tokenCandidate?.trim() ? tokenCandidate.trim() : null
      if (normalizedToken && seenTokens.has(normalizedToken)) {
        nextToken = null
        break
      }

      if (normalizedToken) {
        seenTokens.add(normalizedToken)
      }

      nextToken = normalizedToken
      page += 1
    } while (nextToken && page < maxPages)

    const shipments = [...shipmentsById.values(), ...unkeyedShipments]

    return ApiResponses.success({ data: { shipments, nextToken } })
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
