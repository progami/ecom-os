'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Search, RefreshCw, Building, Package, Archive, Truck } from '@/lib/lucide-icons'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface InventoryBalance {
  id: string
  warehouseId: string | null
  warehouse: {
    code: string
    name: string
  }
  skuId: string | null
  sku: {
    skuCode: string
    description: string
    unitsPerCarton: number
  }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
  lastTransactionDate: string | null
  receiveTransaction?: {
    createdBy?: {
      fullName: string
    }
    transactionDate: string
  }
}

interface InventorySummary {
  totalSkuCount: number
  totalBatchCount: number
  batchesWithInventory: number
  batchesOutOfStock: number
}

interface InventoryResponse {
  data: InventoryBalance[]
  pagination?: {
    totalCount: number
  }
  summary?: InventorySummary
}

function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', `${window.location.origin}/operations/inventory`)
      window.location.href = url.toString()
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/warehouses')
        if (!response.ok) return
        const data = await response.json()
        setWarehouses(data)
      } catch (_error) {
        // ignore silently
      }
    }
    fetchWarehouses()
  }, [])

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        showZeroStock: 'false',
      })
      if (warehouseFilter) {
        params.append('warehouseId', warehouseFilter)
      }
      if (search) {
        params.append('skuCode', search)
      }

      const response = await fetch(`/api/inventory/balances?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(`Failed to load inventory balances: ${errorData.error || response.statusText}`)
        return
      }

      const payload: InventoryResponse | InventoryBalance[] = await response.json()

      if (Array.isArray(payload)) {
        setBalances(payload)
        setSummary(null)
      } else {
        setBalances(payload.data || [])
        setSummary(payload.summary ?? null)
      }
    } catch (_error) {
      toast.error('Failed to load inventory balances')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [search, warehouseFilter])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchBalances()
    }
  }, [fetchBalances, status])

  const metrics = useMemo(() => {
    const totalCartons = balances.reduce((sum, balance) => sum + balance.currentCartons, 0)
    const totalPallets = balances.reduce((sum, balance) => sum + balance.currentPallets, 0)
    const uniqueWarehouses = new Set(balances.map(balance => balance.warehouse.code)).size
    const uniqueSkusFallback = new Set(balances.map(balance => balance.sku.skuCode)).size
    const batchesWithInventoryFallback = balances.filter(balance => balance.currentCartons > 0).length
    const totalBatchCountFallback = balances.length
    const batchesOutOfStockFallback = Math.max(totalBatchCountFallback - batchesWithInventoryFallback, 0)

    return {
      totalCartons,
      totalPallets,
      uniqueWarehouses,
      summary: {
        totalSkuCount: summary?.totalSkuCount ?? uniqueSkusFallback,
        totalBatchCount: summary?.totalBatchCount ?? totalBatchCountFallback,
        batchesWithInventory: summary?.batchesWithInventory ?? batchesWithInventoryFallback,
        batchesOutOfStock: summary?.batchesOutOfStock ?? batchesOutOfStockFallback,
      }
    }
  }, [balances, summary])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Inventory Ledger"
          subtitle="Real-time inventory balances by warehouse and batch"
          icon={Package}
          iconColor="text-indigo-600"
          bgColor="bg-indigo-50"
          borderColor="border-indigo-200"
          textColor="text-indigo-800"
          actions={
            <div className="flex gap-2">
              <Link
                href="/operations/receive"
                className="primary-button"
                prefetch={false}
              >
                <Package className="h-4 w-4 mr-2" />
                Receive
              </Link>
              <Link
                href="/operations/ship"
                className="secondary-button"
                prefetch={false}
              >
                <Truck className="h-4 w-4 mr-2" />
                Ship
              </Link>
              <button
                type="button"
                className="secondary-button"
                onClick={() => fetchBalances()}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          }
        />

        <StatsCardGrid cols={6}>
          <StatsCard
            title="Total Cartons"
            value={metrics.totalCartons}
            subtitle={`${metrics.uniqueWarehouses} ${metrics.uniqueWarehouses === 1 ? 'warehouse' : 'warehouses'}`}
            icon={Package}
            variant="info"
          />
          <StatsCard
            title="Total Pallets"
            value={metrics.totalPallets}
            subtitle="Calculated from cartons"
            icon={Building}
            variant="default"
          />
          <StatsCard
            title="Active SKUs"
            value={metrics.summary.totalSkuCount}
            subtitle="Reporting inventory"
            icon={Search}
            variant="default"
          />
          <StatsCard
            title="Tracked Batches"
            value={metrics.summary.totalBatchCount}
            subtitle="Across all warehouses"
            icon={Archive}
            variant="default"
          />
          <StatsCard
            title="Batches In Stock"
            value={metrics.summary.batchesWithInventory}
            subtitle="Positive balance"
            icon={Building}
            variant="success"
          />
          <StatsCard
            title="Out of Stock Batches"
            value={metrics.summary.batchesOutOfStock}
            subtitle="Needs attention"
            icon={Building}
            variant="danger"
          />
        </StatsCardGrid>

        <div className="flex flex-col md:flex-row gap-3 items-start">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by SKU code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value)}
            className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.code} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Warehouse</th>
                <th className="px-4 py-2 text-left font-medium">SKU</th>
                <th className="px-4 py-2 text-left font-medium">Batch</th>
                <th className="px-4 py-2 text-right font-medium">Cartons</th>
                <th className="px-4 py-2 text-right font-medium">Pallets</th>
                <th className="px-4 py-2 text-right font-medium">Units</th>
                <th className="px-4 py-2 text-left font-medium">Last Transaction</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No inventory balances found for the selected filters.
                  </td>
                </tr>
              )}

              {balances.map((balance) => (
                <tr key={balance.id} className="odd:bg-muted/20">
                  <td className="px-4 py-2">
                    <div className="font-medium text-foreground">{balance.warehouse.name}</div>
                    <div className="text-xs text-muted-foreground">Code: {balance.warehouse.code}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-foreground">{balance.sku.skuCode}</div>
                    <div className="text-xs text-muted-foreground">{balance.sku.description}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{balance.batchLot}</td>
                  <td className="px-4 py-2 text-right font-semibold text-indigo-700">
                    {balance.currentCartons.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">{balance.currentPallets.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{balance.currentUnits.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {balance.lastTransactionDate
                      ? format(new Date(balance.lastTransactionDate), 'PPpp')
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default InventoryPage
