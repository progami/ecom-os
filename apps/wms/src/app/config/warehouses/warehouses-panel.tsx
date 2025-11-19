'use client'

import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, RefreshCw, DollarSign, Upload, Download } from '@/lib/lucide-icons'
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
        throw new Error(error?.error || 'Failed to upload rate list')
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

  const handleDeleteRate = async (rate: CostRate) => {
    if (!confirm(`Delete "${rate.costName}" (${formatCostCategory(rate.costCategory)}) rate (£${rate.costValue.toFixed(2)}/${rate.unitOfMeasure})? This cannot be undone.`)) return

    try {
      const response = await fetchWithCSRF(`/api/settings/rates/${rate.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete rate')
      toast.success('Rate deleted successfully')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete rate')
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
                    <span>•</span>
                    <span>{warehouse._count.inventoryTransactions} txns</span>
                  </div>
                </div>
                {selectedWarehouseId === warehouse.id && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button
                      onClick={() => handleToggleActive(warehouse)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {warehouse.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
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
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Rates */}
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
            <div className="rounded-xl border bg-white shadow-soft mb-6">
              <div className="border-b px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Rate List Attachment</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Store the latest warehouse-specific rate sheet for reference.
                  </p>
                </div>
                {selectedWarehouse.rateListAttachment && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDownloadRateList(selectedWarehouse.id)}
                    disabled={downloadingRateList}
                  >
                    <Download className="h-4 w-4" />
                    {downloadingRateList ? 'Preparing…' : 'Download'}
                  </Button>
                )}
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingRateList}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingRateList ? 'Uploading…' : 'Upload document'}
                  </Button>
                  <p className="text-xs text-slate-500">
                    PDF, Office docs or images up to 10MB.
                  </p>
                </div>
                {selectedWarehouse.rateListAttachment ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {selectedWarehouse.rateListAttachment.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Uploaded{' '}
                        {selectedWarehouse.rateListAttachment.uploadedAt
                          ? new Date(selectedWarehouse.rateListAttachment.uploadedAt).toLocaleString()
                          : 'recently'}
                        {selectedWarehouse.rateListAttachment.uploadedBy
                          ? ` · ${selectedWarehouse.rateListAttachment.uploadedBy}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleDownloadRateList(selectedWarehouse.id)}
                        disabled={downloadingRateList}
                      >
                        <Download className="h-4 w-4" />
                        {downloadingRateList ? 'Preparing…' : 'Download'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleRemoveRateList(selectedWarehouse.id)}
                        disabled={removingRateList}
                      >
                        <Trash2 className="h-4 w-4" />
                        {removingRateList ? 'Removing…' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No rate list uploaded yet.</p>
                )}
              </div>
            </div>
            {/* Cost Rates Card */}
            <div className="rounded-xl border bg-white shadow-soft">
              <div className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Cost Rates</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {activeRates.length} active of {warehouseRates.length} total
                    </p>
                  </div>
                  <Button asChild className="gap-2" size="sm">
                    <Link href={`/config/rates/new?warehouseId=${selectedWarehouse.id}`}>
                      <Plus className="h-4 w-4" />
                      Add Rate
                    </Link>
                  </Button>
                </div>
              </div>

              {warehouseRates.length === 0 ? (
                <div className="p-12 text-center">
                  <DollarSign className="mx-auto h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">No cost rates</h3>
                  <p className="mt-2 text-sm text-slate-500">Add cost rates to calculate storage and handling fees.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Rate</th>
                        <th className="px-4 py-3 text-right font-semibold">Rate</th>
                        <th className="px-4 py-3 text-left font-semibold">Unit</th>
                        <th className="px-4 py-3 text-left font-semibold">Effective</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {warehouseRates.map(rate => {
                        const now = Date.now()
                        const effective = new Date(rate.effectiveDate).getTime()
                        const end = rate.endDate ? new Date(rate.endDate).getTime() : null
                        const isActive = effective <= now && (end === null || end >= now)
                        const isFuture = effective > now

                        return (
                          <tr key={rate.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-slate-900">{rate.costName}</span>
                                <span className={`inline-flex w-fit px-2 py-0.5 text-[11px] font-medium rounded ${getCategoryColor(rate.costCategory)}`}>
                                  {formatCostCategory(rate.costCategory)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs font-semibold text-slate-500">£ / $</span>
                                <span>{rate.costValue.toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{rate.unitOfMeasure}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(rate.effectiveDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium ${
                                  isActive ? 'text-green-600' : isFuture ? 'text-cyan-600' : 'text-slate-500'
                                }`}
                              >
                                {isActive ? 'Active' : isFuture ? 'Future' : 'Expired'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <Link
                                  href={`/config/rates/${rate.id}/edit`}
                                  className="text-cyan-600 hover:text-cyan-700"
                                >
                                  <Edit className="h-4 w-4 inline" />
                                </Link>
                                <button
                                  onClick={() => handleDeleteRate(rate)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4 inline" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    Storage: 'bg-purple-100 text-purple-700',
    Container: 'bg-blue-100 text-blue-700',
    Carton: 'bg-green-100 text-green-700',
    Pallet: 'bg-amber-100 text-amber-700',
    Unit: 'bg-pink-100 text-pink-700',
    Shipment: 'bg-cyan-100 text-cyan-700',
    Accessorial: 'bg-slate-100 text-slate-700'
  }
  return colors[category] || 'bg-slate-100 text-slate-700'
}

function formatCostCategory(category: string) {
  if (category === 'Container') {
    return 'Container - Handling Charges'
  }
  return category
}
