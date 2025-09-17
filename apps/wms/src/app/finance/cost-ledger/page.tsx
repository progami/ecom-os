'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  BarChart3,
  RefreshCw,
  Filter,
  Download,
  Truck,
  Box,
  Package,
  type LucideIcon,
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { CostLedgerBucketTotals, CostLedgerGroupResult } from '@ecom-os/ledger'

interface CostLedgerResponse {
  groups: CostLedgerGroupResult[]
  totals: CostLedgerBucketTotals
  groupBy: 'week' | 'month'
}

interface FilterState {
  warehouse: string
  startDate: string
  endDate: string
}

const defaultFilters: FilterState = {
  warehouse: '',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
}

function CostLedgerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ledgerData, setLedgerData] = useState<CostLedgerGroupResult[]>([])
  const [totals, setTotals] = useState<CostLedgerBucketTotals | null>(null)
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', `${window.location.origin}/finance/cost-ledger`)
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
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!Array.isArray(data)) {
          return
        }

        const mapped = data.map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
        }))

        setWarehouses(mapped)

        if (!filters.warehouse && session?.user?.warehouseId) {
          const match = mapped.find(wh => wh.id === session.user.warehouseId)
          if (match) {
            setFilters((prev) => ({ ...prev, warehouse: match.code }))
          }
        }
      } catch (_error) {
        // ignore
      }
    }

    if (status === 'authenticated') {
      void fetchWarehouses()
    }
  }, [session, status, filters.warehouse])

  const fetchCostLedger = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy,
      })
      if (filters.warehouse) {
        params.append('warehouseCode', filters.warehouse)
      }

      const response = await fetch(`/api/finance/cost-ledger?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(`Failed to load cost ledger: ${errorData.error || response.statusText}`)
        return
      }

      const data: CostLedgerResponse = await response.json()
      setLedgerData(data.groups ?? [])
      setTotals(data.totals ?? null)
    } catch (_error) {
      toast.error('Failed to load cost ledger')
    } finally {
      setLoading(false)
    }
  }, [filters, groupBy])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCostLedger()
    }
  }, [fetchCostLedger, status])

  const handleExport = useCallback(async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy,
      })
      if (filters.warehouse) {
        params.append('warehouseCode', filters.warehouse)
      }

      const response = await fetch(`/api/finance/export/cost-ledger?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errorData.error || 'Export failed')
      }

      const payload = await response.json() as { downloadUrl?: string; filename?: string }
      if (payload.downloadUrl) {
        window.location.href = payload.downloadUrl
        toast.success('Cost ledger export started')
      } else {
        toast.error('Export link was not provided')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export cost ledger'
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }, [filters.startDate, filters.endDate, filters.warehouse, groupBy])

  const summaryCards = useMemo(() => {
    if (!totals) return []

    const totalAmount = totals.total || 0
    const safePercent = (value: number) =>
      totalAmount > 0 ? `${((value / totalAmount) * 100).toFixed(1)}%` : '0.0%'

    const categoryMap: Array<{ key: keyof Omit<CostLedgerBucketTotals, 'total'>; title: string; icon: LucideIcon }> = [
      { key: 'storage', title: 'Storage', icon: Box },
      { key: 'container', title: 'Container', icon: Truck },
      { key: 'pallet', title: 'Pallet', icon: BarChart3 },
      { key: 'carton', title: 'Carton', icon: Package },
      { key: 'unit', title: 'Unit', icon: Package },
      { key: 'transportation', title: 'Transportation', icon: Truck },
      { key: 'accessorial', title: 'Accessorial', icon: Filter },
      { key: 'other', title: 'Other', icon: BarChart3 },
    ]

    const cards = categoryMap.map(({ key, title, icon }) => ({
      title,
      value: formatCurrency(totals[key] ?? 0),
      subtitle: safePercent(totals[key] ?? 0),
      icon,
      variant: 'default' as const,
    }))

    return [
      {
        title: 'Total Cost',
        value: formatCurrency(totalAmount),
        subtitle: 'All categories',
        icon: DollarSign,
        variant: 'info' as const,
      },
      ...cards,
    ]
  }, [totals])

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
          title="Cost Ledger"
          subtitle="Weekly and monthly cost allocations"
          icon={DollarSign}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
          textColor="text-emerald-800"
          actions={
            <div className="flex gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => fetchCostLedger()}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Warehouse</label>
            <select
              value={filters.warehouse}
              onChange={(event) => setFilters((prev) => ({ ...prev, warehouse: event.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.code} value={warehouse.code}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as 'week' | 'month')}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>

        <StatsCardGrid cols={6}>
          {summaryCards.map((card) => (
            <StatsCard key={card.title} {...card} />
          ))}
        </StatsCardGrid>

        <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center px-4 py-3 border-b">
              <Filter className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">
                Showing {ledgerData.length} {groupBy === 'week' ? 'weeks' : 'months'} of cost activity
              </span>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Period</th>
                  <th className="px-4 py-2 text-right font-medium">Storage</th>
                  <th className="px-4 py-2 text-right font-medium">Container</th>
                  <th className="px-4 py-2 text-right font-medium">Pallet</th>
                  <th className="px-4 py-2 text-right font-medium">Carton</th>
                  <th className="px-4 py-2 text-right font-medium">Unit</th>
                  <th className="px-4 py-2 text-right font-medium">Transportation</th>
                  <th className="px-4 py-2 text-right font-medium">Accessorial</th>
                  <th className="px-4 py-2 text-right font-medium">Other</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <div className="text-center text-muted-foreground">
                        No cost ledger data for the selected filters.
                      </div>
                    </td>
                  </tr>
                )}

                {ledgerData.map((group) => (
                  <tr key={`${group.period}-${group.rangeStart}`} className="odd:bg-muted/20">
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground">
                        {formatPeriod(group, groupBy)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateRange(group.rangeStart, group.rangeEnd)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.storage)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.container)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.pallet)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.carton)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.unit)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.transportation)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.accessorial)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(group.costs.other)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-700">
                      {formatCurrency(group.costs.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`
}

function formatPeriod(group: CostLedgerGroupResult, groupBy: 'week' | 'month') {
  if (groupBy === 'month') {
    const date = new Date(group.rangeStart)
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const startDate = new Date(group.rangeStart)
  const endDate = new Date(group.rangeEnd)
  return `Week of ${startDate.toLocaleDateString()} (${endDate.toLocaleDateString()})`
}

export default CostLedgerPage
