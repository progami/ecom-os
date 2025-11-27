'use client'

import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, RefreshCw, Upload, Download, AlertTriangle, CheckCircle2, ClipboardList } from '@/lib/lucide-icons'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Warehouse {
  id: string
  code: string
  name: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
  isActive: boolean
  rateListAttachment?: {
    fileName: string
    size: number
    contentType: string
    uploadedAt: string
    uploadedBy?: string | null
  } | null
  _count: {
    users: number
    costRates: number
    inventoryTransactions: number
  }
}

interface CostRate {
  id: string
  warehouseId: string
  costCategory: string
  costName: string
  costValue: number
  unitOfMeasure: string
  effectiveDate: string
  endDate: string | null
}

type RateTemplate = {
  key: string
  section: string
  label: string
  costCategory: string
  costName: string
  unitOfMeasure: string
  suggestedValue?: number
  note?: string
  optional?: boolean
}

const tacticalRateTemplate: RateTemplate[] = [
  {
    key: 'fcl-20',
    section: 'Inbound',
    label: 'FCL Receiving 20',
    costCategory: 'Container',
    costName: 'FCL Receiving 20',
    unitOfMeasure: 'per_container',
    suggestedValue: 650,
    note: 'Per 20ft container; includes unload/label/palletize'
  },
  {
    key: 'fcl-40',
    section: 'Inbound',
    label: 'FCL Receiving 40',
    costCategory: 'Container',
    costName: 'FCL Receiving 40',
    unitOfMeasure: 'per_container',
    suggestedValue: 825,
    note: 'Per 40ft container; includes unload/label/palletize'
  },
  {
    key: 'fcl-40hq',
    section: 'Inbound',
    label: 'FCL Receiving 40HQ',
    costCategory: 'Container',
    costName: 'FCL Receiving 40HQ',
    unitOfMeasure: 'per_container',
    suggestedValue: 875,
    note: 'Per 40HQ container; includes unload/label/palletize'
  },
  {
    key: 'fcl-45hq',
    section: 'Inbound',
    label: 'FCL Receiving 45HQ',
    costCategory: 'Container',
    costName: 'FCL Receiving 45HQ',
    unitOfMeasure: 'per_container',
    suggestedValue: 950,
    note: 'Per 45HQ container; includes unload/label/palletize'
  },
  {
    key: 'lcl',
    section: 'Inbound',
    label: 'LCL Receiving',
    costCategory: 'Carton',
    costName: 'LCL Receiving',
    unitOfMeasure: 'per_carton',
    suggestedValue: 0.95,
    note: 'Per-carton receiving for LCL'
  },
  {
    key: 'extra-skus',
    section: 'Inbound',
    label: 'Extra SKUs over 10',
    costCategory: 'Unit',
    costName: 'Extra SKUs over 10',
    unitOfMeasure: 'per_sku',
    suggestedValue: 10,
    note: 'Per-SKU over 10 per shipment'
  },
  {
    key: 'storage-0-6',
    section: 'Storage',
    label: 'Pallet Storage 0-6 months',
    costCategory: 'Storage',
    costName: 'Pallet Storage 0-6 months',
    unitOfMeasure: 'per_pallet_day',
    suggestedValue: 0.69,
    note: 'Daily rate per pallet'
  },
  {
    key: 'storage-6-plus',
    section: 'Storage',
    label: 'Pallet Storage 6+ months',
    costCategory: 'Storage',
    costName: 'Pallet Storage 6+ months',
    unitOfMeasure: 'per_pallet_day',
    suggestedValue: 1.2,
    note: 'Daily rate per pallet'
  },
  {
    key: 'outbound-inventory',
    section: 'Outbound',
    label: 'Loose-carton replenishment to FBA',
    costCategory: 'Carton',
    costName: 'Loose-carton replenishment to FBA',
    unitOfMeasure: 'per_carton',
    suggestedValue: 1,
    note: 'Per carton from stock'
  },
  {
    key: 'outbound-min',
    section: 'Outbound',
    label: 'Outbound Shipment Minimum',
    costCategory: 'Accessorial',
    costName: 'Outbound Shipment Minimum',
    unitOfMeasure: 'per_shipment',
    suggestedValue: 15,
    note: 'Per shipment minimum'
  },
  {
    key: 'ocean-freight',
    section: 'Forwarding / Clearance',
    label: 'Ocean Freight (quoted)',
    costCategory: 'transportation',
    costName: 'Ocean Freight',
    unitOfMeasure: 'flat',
    note: 'Enter quoted amount',
    optional: true
  },
  {
    key: 'freight-insurance',
    section: 'Forwarding / Clearance',
    label: 'Freight Insurance (quoted)',
    costCategory: 'Accessorial',
    costName: 'Freight Insurance',
    unitOfMeasure: 'flat',
    note: 'Enter quoted amount',
    optional: true
  },
  {
    key: 'isf',
    section: 'Forwarding / Clearance',
    label: 'ISF fee',
    costCategory: 'Unit',
    costName: 'ISF Fee',
    unitOfMeasure: 'flat',
    suggestedValue: 35,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'clearance-3',
    section: 'Forwarding / Clearance',
    label: 'Customs Clearance (<=3 lines)',
    costCategory: 'Unit',
    costName: 'Customs Clearance (<=3 lines)',
    unitOfMeasure: 'per_invoice',
    suggestedValue: 125,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'clearance-4-plus',
    section: 'Forwarding / Clearance',
    label: 'Customs Clearance (4+ lines)',
    costCategory: 'Unit',
    costName: 'Customs Clearance (4+ lines)',
    unitOfMeasure: 'per_invoice',
    suggestedValue: 175,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'fda-lacey',
    section: 'Forwarding / Clearance',
    label: 'FDA / Lacey / Other Regulatory',
    costCategory: 'Unit',
    costName: 'FDA / Lacey / Other Regulatory',
    unitOfMeasure: 'flat',
    suggestedValue: 50,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'duty',
    section: 'Forwarding / Clearance',
    label: 'Import Duty (pass-through)',
    costCategory: 'Unit',
    costName: 'Import Duty',
    unitOfMeasure: 'flat',
    note: 'Enter duty amount',
    optional: true
  },
  {
    key: 'bond-single',
    section: 'Forwarding / Clearance',
    label: 'Customs Bond - Single',
    costCategory: 'Accessorial',
    costName: 'Customs Bond - Single',
    unitOfMeasure: 'flat',
    suggestedValue: 175,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'bond-yearly',
    section: 'Forwarding / Clearance',
    label: 'Customs Bond - Yearly',
    costCategory: 'Accessorial',
    costName: 'Customs Bond - Yearly',
    unitOfMeasure: 'flat',
    suggestedValue: 550,
    note: 'Legacy brokerage rate (2022)',
    optional: true
  },
  {
    key: 'other-brokerage',
    section: 'Forwarding / Clearance',
    label: 'Other Brokerage / Accessorials',
    costCategory: 'Accessorial',
    costName: 'Other Brokerage / Accessorials',
    unitOfMeasure: 'flat',
    note: 'Enter pass-through amount',
    optional: true
  },
  // FBA direct port service removed from required list; treat as quoted/manual if re-added
]

export default function WarehousesPanel() {
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [costRates, setCostRates] = useState<CostRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [uploadingRateList, setUploadingRateList] = useState(false)
  const [downloadingRateList, setDownloadingRateList] = useState(false)
  const [removingRateList, setRemovingRateList] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showInactive) params.append('includeInactive', 'true')

      const [warehousesRes, ratesRes] = await Promise.all([
        fetchWithCSRF(`/api/warehouses?${params.toString()}`),
        fetchWithCSRF('/api/settings/rates')
      ])

      if (!warehousesRes.ok || !ratesRes.ok) throw new Error('Failed to load data')

      const warehousesData: Warehouse[] = await warehousesRes.json()
      const ratesData: CostRate[] = await ratesRes.json()

      setWarehouses(warehousesData)
      setCostRates(ratesData)

      if (warehousesData.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(warehousesData[0].id)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [showInactive, selectedWarehouseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setIsRefreshing(false)
  }

  const handleRateListFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    warehouseId: string
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingRateList(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetchWithCSRF(`/api/warehouses/${warehouseId}/rate-list`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || error?.details || 'Failed to upload rate list')
      }

      toast.success('Rate list uploaded')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload rate list')
    } finally {
      setUploadingRateList(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownloadRateList = async (warehouseId: string) => {
    setDownloadingRateList(true)
    try {
      const response = await fetchWithCSRF(`/api/warehouses/${warehouseId}/rate-list`)
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || 'Download unavailable')
      }

      const data = await response.json()
      const downloadUrl: string | undefined = data?.attachment?.downloadUrl
      if (downloadUrl) {
        window.open(downloadUrl, '_blank', 'noopener')
      } else {
        toast.error('Download link unavailable')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to prepare download')
    } finally {
      setDownloadingRateList(false)
    }
  }

  const handleRemoveRateList = async (warehouseId: string) => {
    if (!confirm('Remove the current rate list attachment?')) return
    setRemovingRateList(true)
    try {
      const response = await fetchWithCSRF(`/api/warehouses/${warehouseId}/rate-list`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || 'Failed to delete rate list')
      }

      toast.success('Rate list removed')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete rate list')
    } finally {
      setRemovingRateList(false)
    }
  }

  const handleDelete = async (warehouse: Warehouse) => {
    const hasRelatedData = Object.values(warehouse._count).some(count => count > 0)
    const confirmation = hasRelatedData
      ? `This warehouse has related data and will be deactivated. Continue?`
      : `Delete ${warehouse.name}? This cannot be undone.`

    if (!confirm(confirmation)) return

    try {
      const response = await fetchWithCSRF(`/api/warehouses?id=${warehouse.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete warehouse')
      const result = await response.json()
      toast.success(result.message || 'Warehouse deleted')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete warehouse')
    }
  }

  const handleToggleActive = async (warehouse: Warehouse) => {
    try {
      const response = await fetchWithCSRF(`/api/warehouses?id=${warehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !warehouse.isActive })
      })

      if (!response.ok) throw new Error('Failed to update status')
      toast.success(`${warehouse.name} ${warehouse.isActive ? 'deactivated' : 'activated'}`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    }
  }

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
  const warehouseRates = selectedWarehouse
    ? costRates.filter(r => r.warehouseId === selectedWarehouse.id)
    : []

  const activeRates = warehouseRates.filter(rate => {
    const now = Date.now()
    const effective = new Date(rate.effectiveDate).getTime()
    const end = rate.endDate ? new Date(rate.endDate).getTime() : null
    return effective <= now && (end === null || end >= now)
  })

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Warehouse List */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border bg-white shadow-soft">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Warehouses</h3>
                <p className="text-xs text-slate-500">{warehouses.length} total</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded"
                  />
                  Inactive
                </label>
              </div>
            </div>
          </div>

          <div className="divide-y">
            {warehouses.map(warehouse => (
              <div
                key={warehouse.id}
                className={`px-4 py-3 transition-colors ${
                  selectedWarehouseId === warehouse.id ? 'bg-cyan-50' : ''
                }`}
              >
                <div
                  onClick={() => setSelectedWarehouseId(warehouse.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{warehouse.name}</p>
                      <p className="text-xs text-slate-500">{warehouse.code}</p>
                    </div>
                    <Badge
                      className={
                        warehouse.isActive
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }
                    >
                      {warehouse.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {warehouse.address && (
                    <p className="mt-1 text-xs text-slate-500 truncate">{warehouse.address}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>{warehouse._count.costRates} rates</span>
                    <span>-</span>
                    <span>{warehouse._count.inventoryTransactions} txns</span>
                  </div>
                </div>
                {selectedWarehouseId === warehouse.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleToggleActive(warehouse)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {warehouse.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title="Upload rate list"
                          aria-label="Upload rate list"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingRateList}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title={warehouse.rateListAttachment ? 'Download rate list' : 'No rate list uploaded'}
                          aria-label="Download rate list"
                          onClick={() => handleDownloadRateList(warehouse.id)}
                          disabled={!warehouse.rateListAttachment || downloadingRateList}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title={warehouse.rateListAttachment ? 'Remove rate list' : 'No rate list to remove'}
                          aria-label="Remove rate list"
                          onClick={() => handleRemoveRateList(warehouse.id)}
                          disabled={!warehouse.rateListAttachment || removingRateList}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => router.push(`/config/warehouses/${warehouse.id}/edit`)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(warehouse)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Rate list:</span>
                      <span className="truncate">
                        {warehouse.rateListAttachment
                          ? warehouse.rateListAttachment.fileName
                          : 'No upload yet'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedWarehouse ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(event) => handleRateListFileChange(event, selectedWarehouse.id)}
            />
            <TacticalRateChecklist
              warehouse={selectedWarehouse}
              activeRates={activeRates}
              addRateHref={`/config/rates/new?warehouseId=${selectedWarehouse.id}`}
            />
          </div>
        ) : (
          <div className="rounded-xl border bg-white shadow-soft p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-900">No warehouse selected</h3>
            <p className="mt-2 text-sm text-slate-500">Select a warehouse from the list to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}

type ChecklistItem = RateTemplate & { matchedRate?: CostRate }

function normalizeValue(value?: string | null) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeCategory(value?: string | null) {
  const normalized = normalizeValue(value)
  if (normalized.startsWith('container')) return 'container'
  if (normalized.startsWith('carton')) return 'carton'
  if (normalized.startsWith('storage')) return 'storage'
  if (normalized.startsWith('pallet')) return 'pallet'
  if (normalized === 'transportation' || normalized === 'shipment') return 'transportation'
  if (normalized.startsWith('unit')) return 'unit'
  if (normalized.startsWith('accessorial')) return 'accessorial'
  return normalized
}

function normalizeUnit(value?: string | null) {
  const normalized = normalizeValue(value)
    .replace('pallet/day', 'pallet-day')
    .replace('pallet per day', 'pallet-day')
    .replace(/^container$/, 'per_container')
    .replace(/^carton$/, 'per_carton')
    .replace(/^pallet$/, 'per_pallet')
    .replace(/^sku$/, 'per_sku')
    .replace('per container', 'per_container')
    .replace('per carton', 'per_carton')
    .replace('per pallet', 'per_pallet')
    .replace('per pallet day', 'per_pallet_day')
    .replace('per pallet-day', 'per_pallet_day')
    .replace('per hour', 'per_hour')
    .replace('per day', 'per_day')
    .replace('per delivery', 'per_delivery')
    .replace('per shipment', 'per_shipment')
    .replace('per invoice', 'per_invoice')
    .replace('per sku', 'per_sku')
    .replace('flat', 'flat')
  return normalized
}

function buildTacticalChecklist(activeRates: CostRate[]): ChecklistItem[] {
  return tacticalRateTemplate.map(template => {
    const matchedRate = activeRates.find(rate =>
      normalizeCategory(rate.costCategory) === normalizeCategory(template.costCategory) &&
      normalizeValue(rate.costName) === normalizeValue(template.costName) &&
      normalizeUnit(rate.unitOfMeasure) === normalizeUnit(template.unitOfMeasure)
    )

    return { ...template, matchedRate }
  })
}

function buildRateLink(template: RateTemplate, warehouseId: string) {
  const params = new URLSearchParams({
    warehouseId,
    costCategory: template.costCategory,
    costName: template.costName,
    unitOfMeasure: template.unitOfMeasure
  })

  if (template.suggestedValue !== undefined) {
    params.append('costValue', template.suggestedValue.toString())
  }

  return `/config/rates/new?${params.toString()}`
}

function formatSuggestedRate(value?: number) {
  if (value === undefined) return ''
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function TacticalRateChecklist({
  warehouse,
  activeRates,
  addRateHref
}: {
  warehouse: Warehouse
  activeRates: CostRate[]
  addRateHref?: string
}) {
  const checklist = buildTacticalChecklist(activeRates)
  const sections = Array.from(new Set(checklist.map(item => item.section)))
  const missingCount = checklist.filter(item => !item.optional && !item.matchedRate).length
  const isTacticalWarehouse =
    warehouse.code.toLowerCase() === 'tactical' || warehouse.name.toLowerCase().includes('tactical')

  if (!isTacticalWarehouse) return null

  if (checklist.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border bg-slate-50 shadow-soft">
      <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-900/5 p-2 text-slate-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Rate list readiness {isTacticalWarehouse && <span className="text-xs font-medium text-cyan-700">(Tactical)</span>}
            </p>
            <p className="text-xs text-slate-600">
              Checks for the cost names and units the Tactical billing algorithm expects.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              missingCount === 0
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }
          >
            {missingCount === 0 ? 'Complete' : `${missingCount} missing`}
          </Badge>
          {addRateHref && (
            <Button asChild size="sm" className="ml-2">
              <Link href={addRateHref}>
                <Plus className="h-4 w-4" />
                Add Rate
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="divide-y">
        {sections.map(section => {
          const sectionItems = checklist.filter(item => item.section === section)
          return (
            <div key={section} className="space-y-3 px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{section}</p>
              </div>
              <div className="grid gap-2">
                {sectionItems.map(item => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-lg border bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      {item.matchedRate ? (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <span className="text-[11px] text-slate-500">
                            {formatCostCategory(item.costCategory)} - {item.unitOfMeasure}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          Looks for rate name "{item.costName}"{item.note ? `. ${item.note}` : ''}.
                        </p>
                        {item.suggestedValue !== undefined && (
                          <p className="text-[11px] text-slate-500">
                            Template: ${formatSuggestedRate(item.suggestedValue)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.matchedRate ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200">Found</Badge>
                      ) : item.optional ? (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">Optional / quoted</Badge>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link href={buildRateLink(item, warehouse.id)}>Add rate</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatCostCategory(category: string) {
  if (normalizeCategory(category) === 'container') {
    return 'Container - Handling Charges'
  }
  if (normalizeCategory(category) === 'transportation') {
    return 'Transportation'
  }
  if (normalizeCategory(category) === 'accessorial') {
    return 'Accessorial'
  }
  if (normalizeCategory(category) === 'carton') {
    return 'Carton'
  }
  if (normalizeCategory(category) === 'storage') {
    return 'Storage'
  }
  if (normalizeCategory(category) === 'pallet') {
    return 'Pallet'
  }
  if (normalizeCategory(category) === 'unit') {
    return 'Unit'
  }
  return category
}
