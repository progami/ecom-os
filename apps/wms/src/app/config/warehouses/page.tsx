'use client'

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  MapPin,
  RefreshCw,
  AlertTriangle,
  DollarSign,
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { ImportButton } from '@/components/ui/import-button'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, Column } from '@/components/common/data-table'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { toast } from 'react-hot-toast'

interface Warehouse extends Record<string, unknown> {
  id: string
  code: string
  name: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
  isActive: boolean
  _count: {
    users: number
    costRates: number
    inventoryTransactions: number
  }
}

export default function WarehouseAndRatesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6">Loading warehouse configuration...</div>
        </DashboardLayout>
      }
    >
      <WarehouseAndRatesPageContent />
    </Suspense>
  )
}

interface CostRate extends Record<string, unknown> {
  id: string
  warehouseId: string
  warehouse: { id: string; name: string; code: string }
  costCategory: string
  costName: string
  costValue: number
  unitOfMeasure: string
  effectiveDate: string
  endDate: string | null
}

const costCategories = ['Storage', 'Container', 'Carton', 'Pallet', 'Unit', 'Shipment', 'Accessorial'] as const

function WarehouseAndRatesPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState<boolean>(true)
  const [showInactiveWarehouses, setShowInactiveWarehouses] = useState<boolean>(false)

  const [costRates, setCostRates] = useState<CostRate[]>([])
  const [loadingCostRates, setLoadingCostRates] = useState<boolean>(true)

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [rateCategoryFilter, setRateCategoryFilter] = useState<string>('all')
  const [showActiveRatesOnly, setShowActiveRatesOnly] = useState<boolean>(true)
  const [now, setNow] = useState<number>(0)
  const [detailTab, setDetailTab] = useState<'overview' | 'rates'>('overview')

  const replaceUrl = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const loadWarehouses = useCallback(async (includeInactive: boolean) => {
    setLoadingWarehouses(true)
    try {
      const params = new URLSearchParams()
      if (includeInactive) params.append('includeInactive', 'true')
      const response = await fetchWithCSRF(`/api/warehouses?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data: Warehouse[] = await response.json()
      setWarehouses(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch warehouses')
    } finally {
      setLoadingWarehouses(false)
    }
  }, [])

  const loadCostRates = useCallback(async () => {
    setLoadingCostRates(true)
    try {
      const response = await fetchWithCSRF('/api/settings/rates')
      if (!response.ok) throw new Error('Failed to fetch cost rates')
      const data: CostRate[] = await response.json()
      setCostRates(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch cost rates')
    } finally {
      setLoadingCostRates(false)
    }
  }, [])

  useEffect(() => {
    setNow(Date.now())
  }, [])

  useEffect(() => {
    loadWarehouses(showInactiveWarehouses)
  }, [showInactiveWarehouses, loadWarehouses])

  useEffect(() => {
    loadCostRates()
  }, [loadCostRates])

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'rates') {
      setDetailTab('rates')
    } else {
      setDetailTab('overview')
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedWarehouseId && warehouses.some(w => w.id === selectedWarehouseId)) {
      return
    }
    if (warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id)
    } else {
      setSelectedWarehouseId(null)
    }
  }, [warehouses, selectedWarehouseId])

  useEffect(() => {
    const warehouseId = searchParams.get('warehouseId')
    if (!warehouseId) return
    if (!warehouses.some((warehouse) => warehouse.id === warehouseId)) return
    setSelectedWarehouseId(current => (current === warehouseId ? current : warehouseId))
  }, [searchParams, warehouses])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      loadWarehouses(showInactiveWarehouses),
      loadCostRates(),
    ])
    setNow(Date.now())
    setIsRefreshing(false)
  }, [loadWarehouses, loadCostRates, showInactiveWarehouses])

  const handleEditWarehouse = (warehouseId: string) => {
    router.push(`/config/warehouses/${warehouseId}/edit`)
  }

  const handleDeleteWarehouse = async (warehouse: Warehouse) => {
    const hasRelatedData = Object.values(warehouse._count).some(count => count > 0)
    const confirmation = hasRelatedData
      ? `This warehouse has related data and will be deactivated instead of deleted. Continue?`
      : `Are you sure you want to delete ${warehouse.name}? This action cannot be undone.`

    if (!confirm(confirmation)) return

    try {
      const response = await fetchWithCSRF(`/api/warehouses?id=${warehouse.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete warehouse')
      const result = await response.json()
      toast.success(result.message || 'Warehouse deleted')
      await loadWarehouses(showInactiveWarehouses)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete warehouse')
    }
  }

  const handleToggleWarehouseActive = async (warehouse: Warehouse) => {
    try {
      const response = await fetchWithCSRF(`/api/warehouses?id=${warehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !warehouse.isActive })
      })

      if (!response.ok) throw new Error('Failed to update warehouse status')
      toast.success(`${warehouse.name} marked as ${warehouse.isActive ? 'inactive' : 'active'}`)
      await loadWarehouses(showInactiveWarehouses)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update warehouse status')
    }
  }

  const selectedWarehouse = useMemo(
    () => warehouses.find(w => w.id === selectedWarehouseId) || null,
    [warehouses, selectedWarehouseId]
  )

  const warehouseColumns: Column<Warehouse>[] = [
    {
      key: 'name',
      label: 'Warehouse',
      sortable: true,
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{row.name}</span>
          <span className="text-xs text-gray-500">Code: {row.code}</span>
        </div>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      className: 'w-28',
      render: (value) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: '_count.costRates',
      label: 'Cost Rates',
      sortable: true,
      className: 'text-right',
      render: (value) => <span>{value as number}</span>
    },
  ]

  const selectedWarehouseRates = useMemo(() => {
    if (!selectedWarehouse) return []
    return costRates.filter((rate) => rate.warehouseId === selectedWarehouse.id)
  }, [costRates, selectedWarehouse])

  const filteredSelectedWarehouseRates = useMemo(() => {
    if (!selectedWarehouse) return []
    return selectedWarehouseRates
      .filter((rate) => rateCategoryFilter === 'all' || rate.costCategory === rateCategoryFilter)
      .filter((rate) => {
        if (!showActiveRatesOnly || now === 0) return true
        const effectiveTime = new Date(rate.effectiveDate).getTime()
        const endTime = rate.endDate ? new Date(rate.endDate).getTime() : null
        return effectiveTime <= now && (endTime === null || endTime >= now)
      })
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
  }, [selectedWarehouse, selectedWarehouseRates, rateCategoryFilter, showActiveRatesOnly, now])

  const selectedWarehouseStats = useMemo(() => {
    if (!selectedWarehouse) {
      return { active: 0, pending: 0, lastUpdated: null as Date | null }
    }

    let active = 0
    let pending = 0
    let lastEffective = 0
    const nowValue = now || Date.now()

    selectedWarehouseRates.forEach((rate) => {
      const effectiveTime = new Date(rate.effectiveDate).getTime()
      const endTime = rate.endDate ? new Date(rate.endDate).getTime() : null

      if (effectiveTime <= nowValue && (endTime === null || endTime >= nowValue)) {
        active += 1
      } else if (effectiveTime > nowValue) {
        pending += 1
      }

      if (effectiveTime > lastEffective) {
        lastEffective = effectiveTime
      }
    })

    return {
      active,
      pending,
      lastUpdated: lastEffective ? new Date(lastEffective) : null
    }
  }, [selectedWarehouse, selectedWarehouseRates, now])

  const selectedStorageWarning = useMemo(() => {
    if (!selectedWarehouse) return false
    const nowValue = now || Date.now()
    const activeStorageRates = selectedWarehouseRates.filter((rate) => {
      if (rate.costCategory !== 'Storage') return false
      const effectiveTime = new Date(rate.effectiveDate).getTime()
      const endTime = rate.endDate ? new Date(rate.endDate).getTime() : null
      return effectiveTime <= nowValue && (endTime === null || endTime >= nowValue)
    })
    return activeStorageRates.length > 1
  }, [selectedWarehouse, selectedWarehouseRates, now])

  const rateColumns: Column<CostRate>[] = [
    {
      key: 'costCategory',
      label: 'Category',
      sortable: true,
      className: 'w-32',
      render: (value) => <span className={getCategoryBadgeClass(value as string)}>{value as string}</span>
    },
    {
      key: 'costName',
      label: 'Cost Name',
      sortable: true,
      render: (value) => <span className="text-sm text-gray-900">{value as string}</span>
    },
    {
      key: 'costValue',
      label: 'Rate',
      sortable: true,
      className: 'text-right w-32',
      render: (value) => <span className="font-medium">{formatCurrency(value as number)}</span>
    },
    {
      key: 'unitOfMeasure',
      label: 'Unit',
      sortable: true,
      className: 'w-24'
    },
    {
      key: 'effectiveDate',
      label: 'Effective',
      sortable: true,
      className: 'w-32',
      render: (value) => formatDate(value as string)
    },
    {
      key: 'endDate',
      label: 'End',
      sortable: true,
      className: 'w-32',
      render: (value) => value ? formatDate(value as string) : <span className="text-gray-400">Open</span>
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      className: 'w-28',
      render: (_, row) => renderRateStatus(row, now)
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'w-16 text-right',
      render: (_, row) => (
        <Link href={`/config/rates/${row.id}/edit`} className="text-primary hover:text-primary/80">
          <Edit className="h-4 w-4 inline" />
        </Link>
      )
    }
  ]

  const handleWarehouseRowClick = (warehouse: Warehouse) => {
    setSelectedWarehouseId(warehouse.id)
    setDetailTab('overview')
    const params = new URLSearchParams(searchParams.toString())
    params.set('warehouseId', warehouse.id)
    params.delete('view')
    replaceUrl(params)
    setNow(Date.now())
  }

  const handleDetailTabChange = (value: 'overview' | 'rates') => {
    setDetailTab(value)
    const params = new URLSearchParams(searchParams.toString())
    if (selectedWarehouseId) {
      params.set('warehouseId', selectedWarehouseId)
    }
    if (value === 'overview') {
      params.delete('view')
    } else {
      params.set('view', value)
    }
    replaceUrl(params)
    setNow(Date.now())
  }

  const newRateHref = selectedWarehouseId ? `/config/rates/new?warehouseId=${selectedWarehouseId}` : '/config/rates/new'

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        <PageHeader
          title="Warehouses & Cost Rates"
          subtitle="Select a warehouse to review contacts, activity, and pricing"
          icon={Building2}
          iconColor="text-teal-600"
          bgColor="bg-teal-50"
          borderColor="border-teal-200"
          textColor="text-teal-800"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ImportButton
                entityName="warehouses"
                onImportComplete={() => handleRefresh()}
              />
              <Button asChild variant="outline" className="gap-2">
                <Link href={newRateHref}>
                  <DollarSign className="h-4 w-4" />
                  New Cost Rate
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href="/config/warehouses/new">
                  <Plus className="h-4 w-4" />
                  Add Warehouse
                </Link>
              </Button>
            </div>
          }
        />

        <div className="grid lg:grid-cols-[2fr,3fr] gap-4 flex-1">
          <div className="border rounded-lg bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Warehouses</h2>
                  <p className="text-xs text-gray-500">Showing {warehouses.length} locations</p>
                </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={showInactiveWarehouses}
                  onChange={(event) => setShowInactiveWarehouses(event.target.checked)}
                />
                Show inactive
              </label>
            </div>
            </div>
            <DataTable
              data={warehouses}
              columns={warehouseColumns}
              loading={loadingWarehouses}
              emptyMessage="No warehouses found"
              rowKey="id"
              onRowClick={handleWarehouseRowClick}
              getRowClassName={(row) => row.id === selectedWarehouseId ? 'bg-indigo-50/60' : ''}
              className="flex-1"
            />
          </div>

          <div className="border rounded-lg bg-white flex flex-col">
            {selectedWarehouse ? (
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between px-4 py-3 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedWarehouse.name}</h2>
                    <p className="text-sm text-gray-500">Code: {selectedWarehouse.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleToggleWarehouseActive(selectedWarehouse)}
                      variant="outline"
                    >
                      {selectedWarehouse.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      onClick={() => handleEditWarehouse(selectedWarehouse.id)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteWarehouse(selectedWarehouse)}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <Tabs className="flex flex-col h-full">
                  <div className="px-4 pt-4">
                    <TabsList>
                      <TabsTrigger
                        data-state={detailTab === 'overview' ? 'active' : 'inactive'}
                        onClick={() => handleDetailTabChange('overview')}
                      >
                        Overview
                      </TabsTrigger>
                      <TabsTrigger
                        data-state={detailTab === 'rates' ? 'active' : 'inactive'}
                        onClick={() => handleDetailTabChange('rates')}
                      >
                        Cost Rates
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {detailTab === 'overview' && (
                    <TabsContent className="flex-1 overflow-y-auto px-4 pb-6">
                      <div className="mt-4 space-y-4">
                        <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                          <h3 className="text-sm font-semibold text-gray-900">At a glance</h3>
                          <dl className="mt-2 grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-3">
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                              <dd className="mt-1 font-medium text-gray-900">{selectedWarehouse.isActive ? 'Active' : 'Inactive'}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cost rates</dt>
                              <dd className="mt-1 font-medium text-gray-900">{selectedWarehouse._count.costRates}</dd>
                            </div>
                            <div>
                              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Inventory txns</dt>
                              <dd className="mt-1 font-medium text-gray-900">{selectedWarehouse._count.inventoryTransactions}</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="rounded-lg border border-gray-100 bg-white p-4">
                            <h3 className="text-sm font-semibold text-gray-900">Primary contacts</h3>
                            {selectedWarehouse.contactEmail || selectedWarehouse.contactPhone ? (
                              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                                {selectedWarehouse.contactEmail && (
                                  <li>Email: <span className="text-gray-800">{selectedWarehouse.contactEmail}</span></li>
                                )}
                                {selectedWarehouse.contactPhone && (
                                  <li>Phone: <span className="text-gray-800">{selectedWarehouse.contactPhone}</span></li>
                                )}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">No contacts on file.</p>
                            )}
                          </div>

                          <div className="rounded-lg border border-gray-100 bg-white p-4">
                            <h3 className="text-sm font-semibold text-gray-900">Location</h3>
                            <p className="mt-2 text-sm text-gray-600">
                              {selectedWarehouse.address ? selectedWarehouse.address : 'No address provided.'}
                            </p>
                            {selectedWarehouse.latitude && selectedWarehouse.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${selectedWarehouse.latitude},${selectedWarehouse.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <MapPin className="h-4 w-4" /> View on map
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  {detailTab === 'rates' && (
                    <TabsContent className="flex-1 flex flex-col px-4 pb-4">
                      {selectedStorageWarning && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          <AlertTriangle className="h-5 w-5 mt-0.5" />
                          <span>This warehouse has multiple active storage rates. Resolve duplicates to avoid billing issues.</span>
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <SummaryCard
                          title="Active rates"
                          value={selectedWarehouseStats.active}
                          description="Currently applied"
                        />
                        <SummaryCard
                          title="Last effective"
                          value={selectedWarehouseStats.lastUpdated ? formatDate(selectedWarehouseStats.lastUpdated.toISOString()) : 'No rates yet'}
                          description="Most recent start"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-gray-600">Category</label>
                            <select
                              value={rateCategoryFilter}
                              onChange={(event) => setRateCategoryFilter(event.target.value)}
                              className="rounded-md border-gray-300 text-sm"
                            >
                              <option value="all">All</option>
                              {costCategories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </div>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={showActiveRatesOnly}
                              onChange={(event) => {
                                setShowActiveRatesOnly(event.target.checked)
                                setNow(Date.now())
                              }}
                            />
                            Active only
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <ImportButton entityName="costRates" onImportComplete={() => handleRefresh()} />
                          <Button asChild className="gap-2">
                            <Link href={`/config/rates/new?warehouseId=${selectedWarehouse.id}`}>
                              <Plus className="h-4 w-4" />
                              Add Rate
                            </Link>
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 flex-1 overflow-y-auto">
                        <DataTable
                          data={filteredSelectedWarehouseRates}
                          columns={rateColumns}
                          loading={loadingCostRates}
                          emptyMessage="No cost rates configured"
                          rowKey="id"
                        />
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3" />
                  <p>Select a warehouse to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function formatCurrency(value: number) {
  if (Number.isNaN(value)) return '£0.00'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatDate(date: string) {
  return new Date(date).toISOString().slice(0, 10)
}

function getCategoryBadgeClass(category: string) {
  const classes: Record<string, string> = {
    Storage: 'badge-primary',
    Container: 'badge-purple',
    Carton: 'badge-success',
    Pallet: 'badge-warning',
    Unit: 'badge-pink',
    Shipment: 'badge-info',
    Accessorial: 'badge-secondary'
  }
  return classes[category] || 'badge-secondary'
}

function renderRateStatus(rate: CostRate, now: number) {
  if (now === 0) {
    return <span className="text-xs text-gray-400">—</span>
  }

  const effective = new Date(rate.effectiveDate).getTime()
  const end = rate.endDate ? new Date(rate.endDate).getTime() : null

  if (end !== null && end < now) {
    return <span className="text-xs text-gray-500">Expired</span>
  }

  if (effective > now) {
    return <span className="text-xs text-blue-600">Future</span>
  }

  return <span className="text-xs text-green-600">Active</span>
}

interface SummaryCardProps {
  title: string
  value: number | string
  description: string
}

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <div className="bg-white border rounded-md px-3 py-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  )
}
