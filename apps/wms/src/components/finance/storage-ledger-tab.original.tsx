// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Download, Package, BarChart3, ChevronDown, ChevronRight } from '@/lib/lucide-icons'
import { EmptyState } from '@/components/ui/empty-state'
import { StatsCard } from '@/components/ui/stats-card'
import { toast } from 'react-hot-toast'

interface StorageSnapshot {
  date: string
  weekNumber: number
  warehouse: { id: string; name: string; code: string }
  totalPallets: number
  totalCartons: number
  items: {
    sku: { id: string; skuCode: string; description: string }
    batchLot: string
    cartons: number
    pallets: number
    cartonsPerPallet: number
  }[]
}

interface StorageLedgerFilters {
  warehouse?: string
}

interface StorageLedgerTabProps {
  viewMode: 'live' | 'point-in-time'
  selectedDate: string
  searchQuery: string
  filters: StorageLedgerFilters
  showFilters: boolean
  setShowFilters: (show: boolean) => void
  setFilters: (filters: StorageLedgerFilters) => void
  warehouses: { id: string; name: string }[]
}

export function StorageLedgerTab({
  viewMode: _viewMode,
  selectedDate: _selectedDate,
  searchQuery,
  filters,
  showFilters: _showFilters,
  setShowFilters: _setShowFilters,
  setFilters: _setFilters,
  warehouses: _warehouses
}: StorageLedgerTabProps) {
  const [snapshots, setSnapshots] = useState<StorageSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [aggregationView, setAggregationView] = useState<'weekly' | 'monthly'>('weekly')

  const fetchStorageData = useCallback(async () => {
    try {
      setLoading(true)
      // API endpoint removed - set empty data
      setSnapshots([])
    } catch (_error) {
      toast.error(`Failed to load storage ledger: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [dateRange.start, dateRange.end, filters.warehouse])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStorageData()
    }, 100)
    return () => clearTimeout(timer)
  }, [fetchStorageData])

  const handleExport = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // API endpoint removed
    toast.error('Export feature not available')
  }

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  // Get ISO week number (Monday as start of week)
  const getISOWeekNumber = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    // Set to Monday of this week
    const dayNum = d.getDay() || 7 // Make Sunday = 7
    d.setDate(d.getDate() + 1 - dayNum)
    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1)
    // Calculate full weeks between dates
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return weekNum
  }

  // Helper function to determine billing period
  const getBillingPeriod = (date: Date) => {
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()
    
    if (day <= 15) {
      // Previous month 16th to current month 15th
      const startDate = new Date(year, month - 1, 16)
      const endDate = new Date(year, month, 15)
      return {
        start: startDate,
        end: endDate,
        label: `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
    } else {
      // Current month 16th to next month 15th
      const startDate = new Date(year, month, 16)
      const endDate = new Date(year, month + 1, 15)
      return {
        start: startDate,
        end: endDate,
        label: `${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
    }
  }

  // Aggregate weekly snapshots into monthly billing periods
  const aggregateMonthlySnapshots = (weeklySnapshots: StorageSnapshot[]) => {
    const monthlyMap = new Map<string, {
      date: Date
      warehouseId: string
      totalPallets: number
      totalCartons: number
      totalUnits: number
      items: Array<{
        skuId: string
        sku: { skuCode: string; description: string }
        batchLot: string
        pallets: number
        cartons: number
        units: number
      }>
    }>()
    
    weeklySnapshots.forEach(snapshot => {
      const date = new Date(snapshot.date)
      const billingPeriod = getBillingPeriod(date)
      const key = `${billingPeriod.label}-${snapshot.warehouse.id}`
      
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          billingPeriod: billingPeriod.label,
          warehouse: snapshot.warehouse,
          weeks: [],
          totalPalletWeeks: 0,
          totalCartonWeeks: 0,
          itemsMap: new Map()
        })
      }
      
      const monthly = monthlyMap.get(key)
      monthly.weeks.push(snapshot.weekNumber)
      monthly.totalPalletWeeks += snapshot.totalPallets
      monthly.totalCartonWeeks += (snapshot.totalCartons || 0)
      
      // Aggregate items
      snapshot.items.forEach(item => {
        const itemKey = `${item.sku.id}-${item.batchLot}`
        if (!monthly.itemsMap.has(itemKey)) {
          monthly.itemsMap.set(itemKey, {
            sku: item.sku,
            batchLot: item.batchLot,
            totalCartonWeeks: 0,
            totalPalletWeeks: 0,
            cartonsPerPallet: item.cartonsPerPallet
          })
        }
        const monthlyItem = monthly.itemsMap.get(itemKey)
        monthlyItem.totalCartonWeeks += item.cartons
        monthlyItem.totalPalletWeeks += item.pallets
      })
    })
    
    // Convert to array format
    const monthlySnapshots: unknown[] = []
    monthlyMap.forEach(monthly => {
      const items = Array.from(monthly.itemsMap.values())
      
      monthlySnapshots.push({
        ...monthly,
        weekCount: monthly.weeks.length,
        items: items.sort((a: { sku: { skuCode: string } }, b: { sku: { skuCode: string } }) => a.sku.skuCode.localeCompare(b.sku.skuCode))
      })
    })
    
    return monthlySnapshots.sort((a, b) => {
      const dateA = new Date(a.billingPeriod.split(' - ')[0])
      const dateB = new Date(b.billingPeriod.split(' - ')[0])
      return dateB.getTime() - dateA.getTime() || a.warehouse.name.localeCompare(b.warehouse.name)
    })
  }

  // Filter snapshots based on search
  const filteredSnapshots = snapshots.filter(snapshot => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        snapshot.warehouse.name.toLowerCase().includes(query) ||
        snapshot.warehouse.code.toLowerCase().includes(query) ||
        snapshot.items.some(item => 
          item.sku.skuCode.toLowerCase().includes(query) ||
          item.sku.description.toLowerCase().includes(query) ||
          item.batchLot.toLowerCase().includes(query)
        )
      )
    }
    return true
  })
  
  // Apply aggregation based on view
  const displaySnapshots = aggregationView === 'monthly' 
    ? aggregateMonthlySnapshots(filteredSnapshots)
    : filteredSnapshots

  // Calculate summary stats
  const totalPallets = filteredSnapshots.reduce((sum, s) => sum + s.totalPallets, 0)
  const totalCartons = filteredSnapshots.reduce((sum, s) => sum + (s.totalCartons || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-2">

      {/* Date Range and Export Controls */}
      <div className="bg-white border rounded-lg p-2">
        <div className="flex flex-col gap-2">
          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Quick Select:</label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 30)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted/30 transition-colors"
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 90)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted/30 transition-colors"
            >
              Last 90 days
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date()
                start.setMonth(start.getMonth() - 6)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted/30 transition-colors"
            >
              Last 6 months
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const now = new Date()
                const start = new Date(now.getFullYear(), 0, 1)
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted/30 transition-colors"
            >
              Year to date
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const end = new Date()
                const start = new Date('2020-01-01') // Or set to a very early date
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                })
              }}
              className="px-3 py-1 text-sm border rounded-md hover:bg-muted/30 transition-colors"
            >
              All time
            </button>
          </div>
          
          {/* Date Inputs and Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs font-medium text-muted-foreground">From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs font-medium text-muted-foreground">To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fetchStorageData()
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                Update
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/40 rounded-md p-1">
                <button
                  type="button"
                  onClick={() => setAggregationView('weekly')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    aggregationView === 'weekly' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setAggregationView('monthly')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    aggregationView === 'monthly' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => handleExport(e)}
                className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium hover:bg-muted/30 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Filter by Warehouse</label>
              <select
                value={filters.warehouse}
                onChange={(e) => setFilters({ ...filters, warehouse: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-1 md:grid-cols-4">
        <StatsCard
          title="Total Snapshots"
          value={filteredSnapshots.length}
          icon={Calendar}
          size="sm"
        />
        <StatsCard
          title="Total Pallets"
          value={totalPallets.toLocaleString()}
          icon={Package}
          size="sm"
        />
        <StatsCard
          title="Total Cartons"
          value={totalCartons.toLocaleString()}
          icon={Package}
          variant="info"
          size="sm"
        />
        <StatsCard
          title="Avg Pallets/Week"
          value={filteredSnapshots.length > 0 ? (totalPallets / filteredSnapshots.length).toFixed(1) : '0'}
          icon={BarChart3}
          variant="success"
          size="sm"
        />
      </div>

      {/* Storage Ledger Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-2 border-b">
          <h3 className="text-lg font-semibold">
            {aggregationView === 'weekly' ? 'Weekly Storage Snapshots' : 'Monthly Storage Summary'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {displaySnapshots.length} {aggregationView} {aggregationView === 'weekly' ? 'snapshots' : 'periods'}
          </p>
        </div>
        <div className="overflow-x-auto" style={{ maxHeight: '65vh' }}>
          <table className="w-full table-auto text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {aggregationView === 'weekly' ? (
                  <th className="px-3 py-2 text-left font-semibold">
                    Week
                  </th>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left font-semibold">
                      Billing Period
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Weeks
                    </th>
                  </>
                )}
                <th className="px-3 py-2 text-left font-semibold">
                  Warehouse
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {aggregationView === 'weekly' ? 'Total Pallets' : 'Total Pallet-Weeks'}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Total Cartons
                </th>
                <th className="px-3 py-2 text-center font-semibold">
                  SKUs
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {displaySnapshots.map((snapshot) => {
                const key = aggregationView === 'weekly' 
                  ? `${snapshot.date}-${snapshot.warehouse.id}`
                  : `${snapshot.billingPeriod}-${snapshot.warehouse.id}`
                const isExpanded = expandedRows.has(key)
                
                return (
                  <>
                    <tr
                      key={key}
                      className="cursor-pointer odd:bg-muted/10 hover:bg-muted/20 transition-colors"
                      onClick={() => toggleRow(key)}
                    >
                      {aggregationView === 'weekly' ? (
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">W{getISOWeekNumber(new Date(snapshot.date))}</span>
                            <span className="text-muted-foreground text-xs">{new Date(snapshot.date).getFullYear()}</span>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-foreground">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              {snapshot.billingPeriod}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-foreground text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                              {snapshot.weekCount} weeks
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-foreground">
                        {snapshot.warehouse.name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-foreground text-right">
                        {aggregationView === 'weekly' 
                          ? snapshot.totalPallets.toLocaleString()
                          : snapshot.totalPalletWeeks.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-foreground text-right">
                        {snapshot.totalCartons?.toLocaleString() || '0'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-muted-foreground text-center">
                        {snapshot.items.length}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={aggregationView === 'weekly' ? 5 : 6} className="px-3 py-2 bg-muted/30">
                          <div className="text-sm">
                            <h4 className="font-medium mb-2">
                              {aggregationView === 'weekly' ? 'SKU Details' : 'Monthly SKU Summary'}
                            </h4>
                            {aggregationView === 'monthly' && (
                              <p className="text-xs text-muted-foreground mb-3">
                                Weeks included: {snapshot.weeks.join(', ')}
                              </p>
                            )}
                            <table className="w-full table-auto text-sm">
                              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                  <th className="px-2 py-1 text-left font-semibold">SKU Code</th>
                                  <th className="px-2 py-1 text-left font-semibold">Description</th>
                                  <th className="px-2 py-1 text-left font-semibold">Batch/Lot</th>
                                  <th className="px-2 py-1 text-right font-semibold">
                                    {aggregationView === 'weekly' ? 'Cartons' : 'Total Cartons'}
                                  </th>
                                  <th className="px-2 py-1 text-right font-semibold">Config</th>
                                  <th className="px-2 py-1 text-right font-semibold">
                                    {aggregationView === 'weekly' ? 'Pallets' : 'Total Pallets'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {snapshot.items.map((item: { sku: { skuCode: string; description: string }; batchLot: string; pallets: number; cartons: number; units: number }, idx: number) => {
                                  const pallets = aggregationView === 'weekly' ? item.pallets : item.totalPalletWeeks
                                  const totalPallets = aggregationView === 'weekly' ? snapshot.totalPallets : snapshot.totalPalletWeeks
                                  const _percentage = (pallets / totalPallets) * 100
                                  
                                  return (
                                    <tr key={idx} className="odd:bg-white/60">
                                      <td className="px-2 py-1 font-medium text-foreground">{item.sku.skuCode}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{item.sku.description}</td>
                                      <td className="px-2 py-1 text-muted-foreground">{item.batchLot}</td>
                                      <td className="px-2 py-1 text-right">
                                        {(aggregationView === 'weekly' ? item.cartons : item.totalCartonWeeks).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-1 text-right text-xs text-muted-foreground">
                                        {item.cartonsPerPallet}/pallet
                                      </td>
                                      <td className="px-2 py-1 text-right font-semibold text-foreground">{pallets}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {displaySnapshots.length === 0 && (
                <tr>
                  <td
                    colSpan={aggregationView === 'weekly' ? 5 : 6}
                    className="px-4 py-10"
                  >
                    <EmptyState
                      icon={Calendar}
                      title={`No ${aggregationView} storage data found`}
                      description={searchQuery || filters.warehouse
                        ? "Try adjusting your search criteria or filters."
                        : `No ${aggregationView === 'weekly' ? 'Monday snapshots' : 'billing periods'} found in the selected date range.`}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
