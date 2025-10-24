'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BarChart3, Download, Truck, Box, Package, Filter } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { buildCentralLoginUrl } from '@/lib/utils/url'
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
  const [_loading, setLoading] = useState(true)
  const [ledgerData, setLedgerData] = useState<CostLedgerGroupResult[]>([])
  const [totals, setTotals] = useState<CostLedgerBucketTotals | null>(null)
  const [filters] = useState<FilterState>(defaultFilters)
  const [exporting, setExporting] = useState(false)
  const [columnFilters, setColumnFilters] = useState({
    weekEnding: '',
    storageMin: '',
    storageMax: '',
    containerMin: '',
    containerMax: '',
    palletMin: '',
    palletMax: '',
    cartonMin: '',
    cartonMax: '',
    unitMin: '',
    unitMax: '',
    transportationMin: '',
    transportationMax: '',
    accessorialMin: '',
    accessorialMax: '',
    otherMin: '',
    otherMax: '',
    totalMin: '',
    totalMax: '',
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      window.location.href = buildCentralLoginUrl('/finance/cost-ledger')
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  const fetchCostLedger = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: 'week',
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
  }, [filters])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCostLedger()
    }
  }, [fetchCostLedger, status])

  const filteredLedgerData = useMemo(() => {
    const parseNumber = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? null : parsed
    }

    const storageMin = parseNumber(columnFilters.storageMin)
    const storageMax = parseNumber(columnFilters.storageMax)
    const containerMin = parseNumber(columnFilters.containerMin)
    const containerMax = parseNumber(columnFilters.containerMax)
    const palletMin = parseNumber(columnFilters.palletMin)
    const palletMax = parseNumber(columnFilters.palletMax)
    const cartonMin = parseNumber(columnFilters.cartonMin)
    const cartonMax = parseNumber(columnFilters.cartonMax)
    const unitMin = parseNumber(columnFilters.unitMin)
    const unitMax = parseNumber(columnFilters.unitMax)
    const transportationMin = parseNumber(columnFilters.transportationMin)
    const transportationMax = parseNumber(columnFilters.transportationMax)
    const accessorialMin = parseNumber(columnFilters.accessorialMin)
    const accessorialMax = parseNumber(columnFilters.accessorialMax)
    const otherMin = parseNumber(columnFilters.otherMin)
    const otherMax = parseNumber(columnFilters.otherMax)
    const totalMin = parseNumber(columnFilters.totalMin)
    const totalMax = parseNumber(columnFilters.totalMax)

    const matchesRange = (value: number | null | undefined, min: number | null, max: number | null) => {
      const actual = value ?? 0
      if (min !== null && actual < min) return false
      if (max !== null && actual > max) return false
      return true
    }

    return ledgerData.filter(group => {
      const weekEndingFilter = columnFilters.weekEnding.trim().toLowerCase()
      const weekEndingText = formatWeekEnding(group.rangeEnd).toLowerCase()

      if (weekEndingFilter && !weekEndingText.includes(weekEndingFilter)) {
        return false
      }

      const costs = group.costs

      if (!matchesRange(costs.storage, storageMin, storageMax)) return false
      if (!matchesRange(costs.container, containerMin, containerMax)) return false
      if (!matchesRange(costs.pallet, palletMin, palletMax)) return false
      if (!matchesRange(costs.carton, cartonMin, cartonMax)) return false
      if (!matchesRange(costs.unit, unitMin, unitMax)) return false
      if (!matchesRange(costs.transportation, transportationMin, transportationMax)) return false
      if (!matchesRange(costs.accessorial, accessorialMin, accessorialMax)) return false
      if (!matchesRange(costs.other, otherMin, otherMax)) return false
      if (!matchesRange(costs.total, totalMin, totalMax)) return false

      return true
    })
  }, [ledgerData, columnFilters])

  const clearColumnFilter = useCallback((keys: Array<keyof typeof columnFilters>) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      for (const key of keys) {
        next[key] = ''
      }
      return next
    })
  }, [])

  const isFilterActive = useCallback(
    (keys: Array<keyof typeof columnFilters>) =>
      keys.some(key => {
        const value = columnFilters[key]
        return value.trim().length > 0
      }),
    [columnFilters]
  )

  const handleExport = useCallback(async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: 'week',
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
  }, [filters.endDate, filters.startDate, filters.warehouse])

  const categoryBreakdown = useMemo(() => {
    if (!totals) return []

    const totalAmount = totals.total || 0
    const categories: Array<{ key: keyof Omit<CostLedgerBucketTotals, 'total'>; label: string; icon: LucideIcon; value: number; percent: number }> = [
      { key: 'storage', label: 'Storage', icon: Box, value: totals.storage ?? 0, percent: 0 },
      { key: 'container', label: 'Container', icon: Truck, value: totals.container ?? 0, percent: 0 },
      { key: 'pallet', label: 'Pallet', icon: BarChart3, value: totals.pallet ?? 0, percent: 0 },
      { key: 'carton', label: 'Carton', icon: Package, value: totals.carton ?? 0, percent: 0 },
      { key: 'unit', label: 'Unit', icon: Package, value: totals.unit ?? 0, percent: 0 },
      { key: 'transportation', label: 'Transportation', icon: Truck, value: totals.transportation ?? 0, percent: 0 },
      { key: 'accessorial', label: 'Accessorial', icon: BarChart3, value: totals.accessorial ?? 0, percent: 0 },
      { key: 'other', label: 'Other', icon: BarChart3, value: totals.other ?? 0, percent: 0 },
    ]

    return categories
      .map(category => ({
        ...category,
        percent: totalAmount > 0 ? (category.value / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent)
  }, [totals])

  const totalCost = totals?.total ?? 0
  const weeksInView = filteredLedgerData.length
  const totalTransactions = useMemo(
    () =>
      filteredLedgerData.reduce((sum, group) => {
        return sum + (group.transactions?.length ?? 0)
      }, 0),
    [filteredLedgerData]
  )
  const averageWeeklyCost = weeksInView > 0 ? totalCost / weeksInView : 0
  const averagePerTransaction = totalTransactions > 0 ? totalCost / totalTransactions : 0
  const uniqueWarehouses = useMemo(() => {
    const codes = new Set<string>()
    filteredLedgerData.forEach(group => {
      group.details.forEach(detail => {
        codes.add(detail.warehouse)
      })
    })
    return codes.size
  }, [filteredLedgerData])
  const topCategory = categoryBreakdown.find(category => category.value > 0)

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Cost Ledger"
          description="Finance"
          icon={BarChart3}
          actions={
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
          }
        />
        <PageContent>
        <div className="flex flex-col gap-6">

        {totals && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total cost</p>
                  <p className="text-3xl font-semibold text-foreground">{formatCurrency(totalCost)}</p>
                  {weeksInView > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {weeksInView} week{weeksInView === 1 ? '' : 's'} in view • Avg {formatCurrency(averageWeeklyCost)} per week
                    </p>
                  )}
                </div>
                {topCategory && (
                  <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary dark:bg-[#00C2B9]/15 dark:text-[#00C2B9]">
                    <p className="font-medium">Top category</p>
                    <p>{topCategory.label} • {topCategory.percent.toFixed(1)}%</p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 dark:border-[#0b3a52] dark:bg-[#041324]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Transactions</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{totalTransactions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Avg {formatCurrency(averagePerTransaction)} per transaction</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 dark:border-[#0b3a52] dark:bg-[#041324]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Warehouses</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{uniqueWarehouses}</p>
                  <p className="text-xs text-muted-foreground mt-1">Distinct locations contributing costs</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
              <p className="text-sm font-semibold text-foreground">Cost breakdown</p>
              <p className="text-xs text-muted-foreground mt-1">Percent contribution by category</p>
              <div className="mt-4 space-y-3">
                {categoryBreakdown.map(category => (
                  <div key={category.label}>
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>{category.label}</span>
                      <span>{formatCurrency(category.value)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{category.percent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-[width] dark:bg-[#00C2B9]"
                        style={{ width: `${Math.min(100, category.percent)}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {filteredLedgerData.length} weeks of cost activity
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Week Ending</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter week ending"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['weekEnding'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Week ending filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['weekEnding'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={columnFilters.weekEnding}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, weekEnding: e.target.value }))}
                              placeholder="Search week"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Storage</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter storage"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['storageMin', 'storageMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Storage filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['storageMin', 'storageMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.storageMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, storageMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.storageMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, storageMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Container</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter container"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['containerMin', 'containerMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Container filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['containerMin', 'containerMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.containerMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, containerMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.containerMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, containerMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Pallet</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter pallet"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['palletMin', 'palletMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Pallet filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['palletMin', 'palletMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.palletMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, palletMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.palletMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, palletMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Carton</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter carton"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['cartonMin', 'cartonMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Carton filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['cartonMin', 'cartonMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.cartonMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, cartonMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.cartonMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, cartonMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Unit</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter unit"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['unitMin', 'unitMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Unit filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['unitMin', 'unitMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.unitMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, unitMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.unitMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, unitMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Transportation</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter transportation"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['transportationMin', 'transportationMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Transportation filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['transportationMin', 'transportationMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.transportationMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, transportationMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.transportationMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, transportationMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Accessorial</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter accessorial"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['accessorialMin', 'accessorialMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Accessorial filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['accessorialMin', 'accessorialMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.accessorialMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, accessorialMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.accessorialMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, accessorialMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Other</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter other"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['otherMin', 'otherMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Other filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['otherMin', 'otherMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.otherMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, otherMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.otherMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, otherMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-between gap-1">
                      <span>Total</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter total"
                            className={cn(
                              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                              isFilterActive(['totalMin', 'totalMax'])
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Total filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => clearColumnFilter(['totalMin', 'totalMax'])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={columnFilters.totalMin}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, totalMin: e.target.value }))}
                              placeholder="Minimum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                            <input
                              type="number"
                              value={columnFilters.totalMax}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, totalMax: e.target.value }))}
                              placeholder="Maximum"
                              className="w-full rounded-md border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLedgerData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10">
                      <div className="text-center text-muted-foreground">
                        No cost ledger data for the selected filters.
                      </div>
                    </td>
                  </tr>
                )}

                {filteredLedgerData.map((group) => (
                  <tr key={`${group.period}-${group.rangeStart}`} className="odd:bg-muted/20">
                    <td className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                      {formatPeriod(group)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.storage)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.container)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.pallet)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.carton)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.unit)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.transportation)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.accessorial)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(group.costs.other)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {formatCurrency(group.costs.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

function formatWeekEnding(rangeEnd: string) {
  const parsed = new Date(rangeEnd)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return format(parsed, 'PP')
}

function formatPeriod(group: CostLedgerGroupResult) {
  const formatted = formatWeekEnding(group.rangeEnd)
  if (formatted) {
    return formatted
  }

  if (typeof group.period === 'string') {
    return group.period.replace(/^week ending\s*/i, '').trim()
  }

  return ''
}

export default CostLedgerPage
