'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink, Loader2, RefreshCw, Search } from '@/lib/lucide-icons'
import type {
  AmazonInboundShipment,
  AmazonInboundDetails,
  AmazonShipmentState,
  AmazonFreightState,
  FormData,
  LineItem,
  SkuOption,
  NormalizedInboundItem,
} from './types'
import {
  getStringField,
  formatAmazonAddress,
  getAddressField,
  normalizeInboundItems,
} from './helpers'

interface AmazonImportTabProps {
  amazonShipment: AmazonShipmentState
  setAmazonShipment: React.Dispatch<React.SetStateAction<AmazonShipmentState>>
  setAmazonFreight: React.Dispatch<React.SetStateAction<AmazonFreightState>>
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  setLineItems: React.Dispatch<React.SetStateAction<LineItem[]>>
  skus: SkuOption[]
}

export function AmazonImportTab({
  amazonShipment,
  setAmazonShipment,
  setAmazonFreight,
  setFormData,
  setLineItems,
  skus,
}: AmazonImportTabProps) {
  const [shipments, setShipments] = useState<AmazonInboundShipment[]>([])
  const [shipmentsLoading, setShipmentsLoading] = useState(false)
  const [shipmentsError, setShipmentsError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [manualId, setManualId] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [amazonBolUrl, setAmazonBolUrl] = useState<string | null>(null)
  const [amazonContents, setAmazonContents] = useState<NormalizedInboundItem[]>([])

  const loadShipments = useCallback(async () => {
    setShipmentsLoading(true)
    setShipmentsError(null)
    try {
      const response = await fetch('/api/amazon/inbound-shipments', { credentials: 'include' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to fetch Amazon shipments')
      }
      const list = Array.isArray(payload?.data?.shipments) ? payload.data.shipments : []
      setShipments(list)
    } catch (error) {
      setShipments([])
      setShipmentsError(error instanceof Error ? error.message : 'Failed to fetch Amazon shipments')
    } finally {
      setShipmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadShipments()
  }, [loadShipments])

  const filteredShipments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return shipments

    return shipments.filter(shipment => {
      const record = shipment as Record<string, unknown>
      const shipmentId = getStringField(record, ['ShipmentId', 'shipmentId'])
      const shipmentName = getStringField(record, ['ShipmentName', 'shipmentName'])
      const shipmentStatus = getStringField(record, ['ShipmentStatus', 'shipmentStatus'])
      return [shipmentId, shipmentName, shipmentStatus].some(value =>
        value.toLowerCase().includes(term)
      )
    })
  }, [shipments, searchTerm])

  const getDefaultBatch = (sku?: SkuOption | null) => {
    if (!sku?.batches?.length) return null
    const defaultBatch = sku.batches.find(
      batch => typeof batch.batchCode === 'string' && batch.batchCode.toUpperCase() === 'DEFAULT'
    )
    return defaultBatch ?? sku.batches[0]
  }

  const handleImport = async (shipmentId: string) => {
    if (!shipmentId.trim()) {
      toast.error('Amazon shipment ID is required')
      return
    }

    setImportLoading(true)
    try {
      const response = await fetch(
        `/api/amazon/inbound-shipments/${encodeURIComponent(shipmentId)}`,
        { credentials: 'include' }
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to fetch Amazon shipment')
      }

      const details = payload?.data as AmazonInboundDetails | undefined
      const shipment = details?.shipment ?? null
      const normalized = details?.normalized

      const resolvedShipmentId =
        normalized?.shipmentId ?? shipment?.ShipmentId ?? details?.shipmentId ?? shipmentId
      const shipFromAddress =
        normalized?.shipFromAddress ??
        (shipment?.ShipFromAddress && typeof shipment.ShipFromAddress === 'object'
          ? (shipment.ShipFromAddress as Record<string, unknown>)
          : null)
      const shipToAddress = normalized?.shipToAddress ?? null

      setAmazonShipment(prev => ({
        ...prev,
        shipmentId: resolvedShipmentId,
        shipmentName: normalized?.shipmentName ?? shipment?.ShipmentName ?? '',
        shipmentStatus: normalized?.shipmentStatus ?? shipment?.ShipmentStatus ?? '',
        destinationFulfillmentCenterId:
          normalized?.destinationFulfillmentCenterId ??
          shipment?.DestinationFulfillmentCenterId ??
          '',
        labelPrepType: normalized?.labelPrepType ?? shipment?.LabelPrepType ?? '',
        boxContentsSource: normalized?.boxContentsSource ?? shipment?.BoxContentsSource ?? '',
        shipFromAddress,
        shipToAddress,
        referenceId: normalized?.referenceId || prev.referenceId || '',
        inboundPlanId: normalized?.inboundPlanId ?? prev.inboundPlanId,
        inboundOrderId: normalized?.inboundOrderId ?? prev.inboundOrderId,
      }))
      setAmazonBolUrl(details?.billOfLadingUrl ?? null)

      const pickupAddress = shipFromAddress ? formatAmazonAddress(shipFromAddress) : ''
      const pickupContactName = shipFromAddress
        ? getAddressField(shipFromAddress, ['Name', 'name'])
        : ''
      const pickupContactPhone = shipFromAddress
        ? getAddressField(shipFromAddress, ['Phone', 'phone'])
        : ''

      setAmazonFreight(prev => ({
        ...prev,
        shipmentReference: prev.shipmentReference || normalized?.shipmentName || shipment?.ShipmentName || '',
        pickupAddress: prev.pickupAddress || pickupAddress,
        pickupContactName: prev.pickupContactName || pickupContactName,
        pickupContactPhone: prev.pickupContactPhone || pickupContactPhone,
      }))

      const destinationAddress = shipToAddress ? formatAmazonAddress(shipToAddress) : ''
      const destinationCountry = shipToAddress
        ? getAddressField(shipToAddress, ['CountryCode', 'countryCode', 'country'])
        : ''

      setFormData(prev => ({
        ...prev,
        destinationType: 'AMAZON_FBA',
        destinationName:
          normalized?.destinationFulfillmentCenterId ??
          shipment?.DestinationFulfillmentCenterId ??
          prev.destinationName,
        destinationAddress: destinationAddress || prev.destinationAddress,
        destinationCountry: destinationCountry || prev.destinationCountry,
        externalReference: resolvedShipmentId || prev.externalReference,
      }))

      const rawItems = Array.isArray(details?.inboundPlanItems) && details?.inboundPlanItems.length
        ? details?.inboundPlanItems
        : Array.isArray(details?.items)
          ? details?.items
          : []
      const normalizedItems = normalizeInboundItems(rawItems)
      setAmazonContents(normalizedItems)

      const skuMap = new Map(skus.map(sku => [sku.skuCode.toLowerCase(), sku]))
      const missingSkus = new Set<string>()
      const missingBatches = new Set<string>()
      const lineMap = new Map<string, LineItem>()

      for (const item of normalizedItems) {
        const rawSku = item.sku.trim()
        if (!rawSku) continue

        const sku = skuMap.get(rawSku.toLowerCase())
        if (!sku) {
          missingSkus.add(rawSku)
          continue
        }

        const defaultBatch = getDefaultBatch(sku)
        const batchLot = defaultBatch?.batchCode ?? ''
        if (!batchLot) {
          missingBatches.add(sku.skuCode)
        }

        const quantityUnits = item.quantityExpected ?? 0
        if (!Number.isFinite(quantityUnits) || quantityUnits <= 0) continue

        const fallbackUnitsPerCarton =
          defaultBatch?.unitsPerCarton ?? sku.unitsPerCarton ?? null
        const unitsPerCarton =
          item.quantityInCase && item.quantityInCase > 0
            ? item.quantityInCase
            : fallbackUnitsPerCarton && fallbackUnitsPerCarton > 0
              ? fallbackUnitsPerCarton
              : 1

        const cartons = Math.ceil(quantityUnits / unitsPerCarton)
        if (!Number.isFinite(cartons) || cartons <= 0) continue

        const key = `${sku.skuCode}::${batchLot}`
        const existing = lineMap.get(key)
        if (existing) {
          existing.quantity += cartons
          continue
        }

        lineMap.set(key, {
          id: crypto.randomUUID(),
          skuCode: sku.skuCode,
          skuDescription: sku.description,
          batchLot,
          quantity: cartons,
          notes: '',
        })
      }

      const importedLines = Array.from(lineMap.values())
      if (importedLines.length > 0) {
        setLineItems(importedLines)
      }

      if (missingSkus.size > 0) {
        const list = Array.from(missingSkus)
        const preview = list.slice(0, 3).join(', ')
        toast.error(`Missing SKUs in WMS: ${preview}${list.length > 3 ? '...' : ''}`)
      }

      if (missingBatches.size > 0) {
        const list = Array.from(missingBatches)
        const preview = list.slice(0, 3).join(', ')
        toast.error(`Missing batches for SKUs: ${preview}${list.length > 3 ? '...' : ''}`)
      }

      toast.success('Amazon shipment imported')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import Amazon shipment')
    } finally {
      setImportLoading(false)
    }
  }

  const hasShipment = Boolean(amazonShipment.shipmentId)

  return (
    <div className="space-y-6">
      {/* Shipment Browser */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Amazon Shipments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a shipment to import or enter an ID manually
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadShipments}
            disabled={shipmentsLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${shipmentsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by shipment ID, name, or status..."
              className="pl-9 text-sm"
            />
          </div>

          {/* Shipment List */}
          <div className="rounded-lg border bg-slate-50 overflow-hidden">
            {shipmentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading shipments...
              </div>
            ) : shipmentsError ? (
              <div className="p-4">
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {shipmentsError}
                </div>
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No shipments match your search.' : 'No shipments found.'}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                {filteredShipments.map((shipment, index) => {
                  const record = shipment as Record<string, unknown>
                  const id = getStringField(record, ['ShipmentId', 'shipmentId'])
                  const name = getStringField(record, ['ShipmentName', 'shipmentName'])
                  const status = getStringField(record, ['ShipmentStatus', 'shipmentStatus'])
                  const destination = getStringField(record, [
                    'DestinationFulfillmentCenterId',
                    'destinationFulfillmentCenterId',
                  ])
                  const isSelected = amazonShipment.shipmentId === id

                  return (
                    <button
                      key={id || `${index}-shipment`}
                      type="button"
                      onClick={() => handleImport(id)}
                      disabled={importLoading || !id}
                      className={`w-full px-5 py-4 text-left transition-colors ${
                        isSelected
                          ? 'bg-cyan-50 border-l-4 border-l-cyan-600'
                          : 'bg-white hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 truncate">
                              {id || 'Unknown shipment'}
                            </span>
                            {isSelected && (
                              <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
                                Imported
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5 truncate">
                            {name || 'No name'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            FC: {destination || '—'}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {status && (
                            <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                              {status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Manual ID Entry */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5">
                Or enter shipment ID manually
              </label>
              <Input
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="FBA shipment ID..."
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={() => handleImport(manualId)}
              disabled={importLoading || !manualId.trim()}
              className="gap-2"
            >
              {importLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Imported Shipment Summary */}
      {hasShipment && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">Imported Shipment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shipment details from Amazon
              </p>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
              {amazonShipment.shipmentStatus || 'Imported'}
            </Badge>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Shipment ID</div>
                <div className="text-sm font-medium text-foreground">
                  {amazonShipment.shipmentId}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Shipment Name</div>
                <div className="text-sm text-foreground">
                  {amazonShipment.shipmentName || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Destination FC</div>
                <div className="text-sm text-foreground">
                  {amazonShipment.destinationFulfillmentCenterId || '—'}
                </div>
              </div>
              {amazonShipment.inboundPlanId && (
                <div>
                  <div className="text-xs text-muted-foreground">Inbound Plan ID</div>
                  <div className="text-sm text-foreground">{amazonShipment.inboundPlanId}</div>
                </div>
              )}
              {amazonShipment.inboundOrderId && (
                <div>
                  <div className="text-xs text-muted-foreground">AWD Order ID</div>
                  <div className="text-sm text-foreground">{amazonShipment.inboundOrderId}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Label Prep Type</div>
                <div className="text-sm text-foreground">
                  {amazonShipment.labelPrepType || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Box Contents Source</div>
                <div className="text-sm text-foreground">
                  {amazonShipment.boxContentsSource || '—'}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Amazon Reference ID (PO)
                </label>
                <Input
                  value={amazonShipment.referenceId}
                  onChange={e =>
                    setAmazonShipment(prev => ({ ...prev, referenceId: e.target.value }))
                  }
                  placeholder="Amazon reference ID (PO)"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Ship From</label>
                <Textarea
                  value={formatAmazonAddress(amazonShipment.shipFromAddress)}
                  readOnly
                  rows={3}
                  className="text-sm bg-slate-50"
                />
              </div>
              {amazonShipment.shipToAddress && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Ship To</label>
                  <Textarea
                    value={formatAmazonAddress(amazonShipment.shipToAddress)}
                    readOnly
                    rows={3}
                    className="text-sm bg-slate-50"
                  />
                </div>
              )}
            </div>

            {amazonBolUrl && (
              <a
                href={amazonBolUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Amazon Bill of Lading
              </a>
            )}

            {/* Shipment Contents */}
            {amazonContents.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Shipment Contents</label>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-4 gap-3 border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    <span>SKU</span>
                    <span>Units Expected</span>
                    <span>Units Received</span>
                    <span>Units / Case</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {amazonContents.map((item, index) => (
                      <div
                        key={`${item.sku}-${index}`}
                        className="grid grid-cols-4 gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0"
                      >
                        <span className="font-medium text-slate-700">{item.sku}</span>
                        <span>{item.quantityExpected}</span>
                        <span>{item.quantityReceived ?? '—'}</span>
                        <span>{item.quantityInCase ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
