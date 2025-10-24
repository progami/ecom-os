'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  BarChart3,
  Filter,
  Download,
  Truck,
  Box,
  Package,
  type LucideIcon,
} from '@/lib/lucide-icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import type { CostLedgerBucketTotals, CostLedgerGroupResult } from '@ecom-os/ledger'

const baseFilterInputClass = 'w-full rounded-md border border-muted px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary'

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
      const portalAuth = process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', portalAuth)
      url.searchParams.set('callbackUrl', `${window.location.origin}/finance/cost-ledger`)
      window.location.href = url.toString()
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

  const renderNumericFilter = (
    label: string,
    minKey: keyof typeof columnFilters,
    maxKey: keyof typeof columnFilters
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter ${label}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted/30 hover:text-primary"
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{label} range</span>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setColumnFilters(prev => ({ ...prev, [minKey]: '', [maxKey]: '' }))}
          >
            Clear
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={columnFilters[minKey] as string}
            onChange={(event) => setColumnFilters(prev => ({ ...prev, [minKey]: event.target.value }))}
            placeholder="Min"
            className={`${baseFilterInputClass} text-right`}
          />
          <input
            type="number"
            inputMode="numeric"
            value={columnFilters[maxKey] as string}
            onChange={(event) => setColumnFilters(prev => ({ ...prev, [maxKey]: event.target.value }))}
            placeholder="Max"
            className={`${baseFilterInputClass} text-right`}
          />
        </div>
      </PopoverContent>
    </Popover>
  )

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

        <StatsCardGrid cols={6}>
          {summaryCards.map((card) => (
            <StatsCard key={card.title} {...card} />
          ))}
        </StatsCardGrid>

        <div className="rounded-xl border border-slate-200 bg-white shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
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
                              columnFilters.weekEnding
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                                : 'hover:bg-muted/30 hover:text-primary'
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Week ending filter</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => setColumnFilters(prev => ({ ...prev, weekEnding: '' }))}
                            >
                              Clear
                            </button>
                          </div>
                          <input
                            type="text"
                            value={columnFilters.weekEnding}
                            onChange={(event) => setColumnFilters(prev => ({ ...prev, weekEnding: event.target.value }))}
                            placeholder="Search week ending"
                            className={baseFilterInputClass}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Storage</span>
                      {renderNumericFilter('Storage', 'storageMin', 'storageMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Container</span>
                      {renderNumericFilter('Container', 'containerMin', 'containerMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Pallet</span>
                      {renderNumericFilter('Pallet', 'palletMin', 'palletMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Carton</span>
                      {renderNumericFilter('Carton', 'cartonMin', 'cartonMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Unit</span>
                      {renderNumericFilter('Unit', 'unitMin', 'unitMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Transportation</span>
                      {renderNumericFilter('Transportation', 'transportationMin', 'transportationMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Accessorial</span>
                      {renderNumericFilter('Accessorial', 'accessorialMin', 'accessorialMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Other</span>
                      {renderNumericFilter('Other', 'otherMin', 'otherMax')}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      {renderNumericFilter('Total', 'totalMin', 'totalMax')}
                    </div>
                  </th>
                </tr>
                <tr className="bg-white text-xs text-muted-foreground">
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
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
