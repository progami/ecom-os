'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Filter, 
  Download, 
  DollarSign, 
  Package, 
  Truck, 
  Box,
  ChevronDown,
  ChevronRight,
  FileText
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { formatDateGMT } from '@/lib/date-utils'
import { StatsCard } from '@/components/ui/stats-card'

interface CostDetail {
  transactionId: string
  transactionDate: string
  transactionType: string
  warehouse: string
  sku: string
  batchLot: string
  costCategory: string
  costName: string
  unitRate: number
  quantity: number
  totalCost: number
}

interface WeekCosts {
  weekStarting: string
  weekEnding: string
  costs: {
    storage: number
    container: number
    pallet: number
    carton: number
    unit: number
    transportation: number
    accessorial: number
    total: number
  }
  transactions: Array<{
    id: string
    transactionId: string
    transactionDate: string
    transactionType: string
    warehouseCode: string
    skuCode: string
    batchLot: string
    cartonsIn: number
    cartonsOut: number
    palletQty: number
    category: string
    costType: string
    rate: number
    quantity: number
    totalCost: number
  }>
  details: CostDetail[]
}

export default function CostLedgerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ledgerData, setLedgerData] = useState<WeekCosts[]>([])
  const [totals, setTotals] = useState<{
    total: number
    container: number
    pallet: number
    carton: number
    unit: number
    transportation: number
    accessorial: number
    other: number
  }>({
    total: 0,
    container: 0,
    pallet: 0,
    carton: 0,
    unit: 0,
    transportation: 0,
    accessorial: 0
  })
  const [warehouses, setWarehouses] = useState<{id: string; name: string}[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week')
  const [filters, setFilters] = useState({
    warehouse: '',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  // Get ISO week number (Monday as start of week) - for display only
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

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    // Fetch warehouses
    const fetchWarehouses = async () => {
      const response = await fetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data)
      }
    }
    fetchWarehouses()
  }, [])

  const fetchCostLedger = useCallback(async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy,
        ...(filters.warehouse && { warehouseCode: filters.warehouse })
      })

      const response = await fetch(`/api/finance/cost-ledger?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(`Failed to load cost ledger: ${errorData.error || response.statusText}`)
        return
      }

      const data = await response.json()
      setLedgerData(data.ledgerData || [])
      setTotals(data.totals || {})
    } catch (_error) {
      toast.error('Failed to load cost ledger')
    } finally {
      setLoading(false)
    }
  }, [filters, groupBy])

  useEffect(() => {
    fetchCostLedger()
  }, [fetchCostLedger])

  const toggleWeek = (weekKey: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey)
    } else {
      newExpanded.add(weekKey)
    }
    setExpandedWeeks(newExpanded)
  }

  const toggleCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey)
    } else {
      newExpanded.add(categoryKey)
    }
    setExpandedCategories(newExpanded)
  }

  const handleExport = () => {
    // Export disabled - API removed
    toast.error('Export functionality is currently unavailable')
    /* Disabled - API removed
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      groupBy,
      ...(filters.warehouse && { warehouseId: filters.warehouse })
    })
    window.open(`/api/finance/export/cost-ledger?${params}`, '_blank')
    toast.success('Exporting cost ledger...')
    */
  }

  // Filter ledger data based on search
  const filteredLedger = ledgerData.filter(week => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    
    // Search in details
    return week.details.some(detail => 
      detail.sku.toLowerCase().includes(query) ||
      detail.warehouse.toLowerCase().includes(query) ||
      detail.batchLot.toLowerCase().includes(query) ||
      detail.transactionId.toLowerCase().includes(query)
    )
  })

  if (loading || status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'storage': return <Box className="h-4 w-4" />
      case 'container': return <Package className="h-4 w-4" />
      case 'transportation': return <Truck className="h-4 w-4" />
      default: return <DollarSign className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'storage': return 'text-blue-600 bg-blue-100'
      case 'container': return 'text-purple-600 bg-purple-100'
      case 'pallet': return 'text-green-600 bg-green-100'
      case 'carton': return 'text-orange-600 bg-orange-100'
      case 'unit': return 'text-pink-600 bg-pink-100'
      case 'transportation': return 'text-red-600 bg-red-100'
      case 'accessorial': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-2">
        {/* Page Header */}
        <PageHeader
          title="Cost Ledger"
          subtitle="Comprehensive cost tracking and analysis"
          icon={DollarSign}
          iconColor="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-800"
          actions={
            <div className="flex items-center gap-2">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'week' | 'month')}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="week">Group by Week</option>
                <option value="month">Group by Month</option>
              </select>
              <button 
                type="button"
                onClick={handleExport}
                className="secondary-button"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          }
        />

        {/* Cost Summary Cards */}
        {totals && (
          <div className="grid gap-1 md:grid-cols-4">
            <StatsCard
              title="Total Costs"
              value={formatCurrency(totals.total)}
              icon={DollarSign}
              size="sm"
            />
            <StatsCard
              title="Handling Costs"
              value={formatCurrency(totals.container + totals.pallet + totals.carton + totals.unit)}
              subtitle={`${totals.total > 0 ? (((totals.container + totals.pallet + totals.carton + totals.unit) / totals.total) * 100).toFixed(1) : '0.0'}% of total`}
              icon={Package}
              variant="success"
              size="sm"
            />
            <StatsCard
              title="Transportation Costs"
              value={formatCurrency(totals.transportation || 0)}
              subtitle={`${totals.total > 0 ? (((totals.transportation || 0) / totals.total) * 100).toFixed(1) : '0.0'}% of total`}
              icon={Truck}
              variant="danger"
              size="sm"
            />
            <StatsCard
              title="Accessorial Costs"
              value={formatCurrency(totals.accessorial || 0)}
              subtitle={`${totals.total > 0 ? (((totals.accessorial || 0) / totals.total) * 100).toFixed(1) : '0.0'}% of total`}
              icon={FileText}
              variant="info"
              size="sm"
            />
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by SKU, warehouse, batch, or transaction ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${
                showFilters 
                  ? 'border-primary bg-primary text-white' 
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Warehouse</label>
                  <select
                    value={filters.warehouse}
                    onChange={(e) => setFilters({...filters, warehouse: e.target.value})}
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
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFilters({
                      warehouse: '',
                      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      endDate: new Date().toISOString().split('T')[0]
                    })
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cost Ledger Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h3 className="text-lg font-semibold">Cost Details by {groupBy === 'week' ? 'Week' : 'Month'}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredLedger.length} {groupBy === 'week' ? 'weeks' : 'months'} • Click on a {groupBy} to view detailed transaction costs
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Container
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pallet
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carton
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transportation
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accessorial
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLedger.map((week, _idx) => {
                  const weekKey = groupBy === 'week' ? week.weekStarting : (week as { month: string }).month
                  const isExpanded = expandedWeeks.has(weekKey)
                  
                  return (
                    <React.Fragment key={weekKey}>
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleWeek(weekKey)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            {groupBy === 'week' ? (
                              <div>
                                <div className="font-medium">
                                  W{getISOWeekNumber(new Date(week.weekStarting))} {new Date(week.weekStarting).getFullYear()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(week.weekStarting).toLocaleDateString()} - {new Date(week.weekEnding).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <div>{(week as { month: string }).month}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {week.costs.container > 0 ? formatCurrency(week.costs.container) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {week.costs.pallet > 0 ? formatCurrency(week.costs.pallet) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {week.costs.carton > 0 ? formatCurrency(week.costs.carton) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {week.costs.unit > 0 ? formatCurrency(week.costs.unit) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {(week.costs.transportation || 0) > 0 ? formatCurrency(week.costs.transportation || 0) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {week.costs.accessorial > 0 ? formatCurrency(week.costs.accessorial) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                          {formatCurrency(week.costs.total)}
                        </td>
                      </tr>
                      
                      {/* Expanded details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Cost Breakdown by Category</h4>
                              
                              {/* Group details by category */}
                              {(() => {
                                const categorySummary = week.details.reduce((acc, detail) => {
                                  // Handle cases where category might be undefined
                                  const categoryName = detail.costCategory || 'Unknown'
                                  const category = categoryName.toLowerCase()
                                  if (!acc[category]) {
                                    acc[category] = {
                                      name: categoryName,
                                      totalCost: 0,
                                      totalQuantity: 0,
                                      transactions: []
                                    }
                                  }
                                  acc[category].totalCost += detail.totalCost || 0
                                  acc[category].totalQuantity += detail.quantity || 0
                                  acc[category].transactions.push(detail)
                                  return acc
                                }, {} as Record<string, { category: string; totalCost: number; count: number }>)

                                // Sort categories by total cost descending
                                const sortedCategories = Object.values(categorySummary).sort((a: { totalCost: number }, b: { totalCost: number }) => b.totalCost - a.totalCost)

                                return (
                                  <div className="space-y-1">
                                    {sortedCategories.map((category: { category: string; totalCost: number; count: number }) => {
                                      const categoryKey = `${weekKey}-${category.name}`
                                      const isCategoryExpanded = expandedCategories.has(categoryKey)
                                      
                                      return (
                                        <div key={category.name} className="border rounded-lg bg-white">
                                          <div 
                                            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleCategory(categoryKey)
                                            }}
                                          >
                                            <div className="flex items-center gap-3">
                                              {isCategoryExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-gray-400" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                              )}
                                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category.name)}`}>
                                                {getCategoryIcon(category.name)}
                                                {category.name}
                                              </span>
                                              <span className="text-sm text-gray-600">
                                                {category.transactions.length} transaction{category.transactions.length !== 1 ? 's' : ''}
                                              </span>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-sm font-semibold">{formatCurrency(category.totalCost)}</div>
                                              <div className="text-xs text-gray-500">Qty: {category.totalQuantity}</div>
                                            </div>
                                          </div>
                                          
                                          {isCategoryExpanded && (
                                            <div className="border-t px-4 py-2">
                                              <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Transaction</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cost</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                  {category.transactions.map((detail: CostDetail, idx: number) => (
                                                    <tr key={`${detail.transactionId}-${idx}`} className="hover:bg-gray-50">
                                                      <td className="px-3 py-2 text-xs">
                                                        {formatDateGMT(detail.transactionDate)}
                                                      </td>
                                                      <td className="px-3 py-2 text-xs font-mono">
                                                        {detail.transactionId.slice(0, 8)}...
                                                      </td>
                                                      <td className="px-3 py-2 text-xs">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                          detail.transactionType === 'RECEIVE' ? 'bg-green-100 text-green-800' :
                                                          detail.transactionType === 'SHIP' ? 'bg-red-100 text-red-800' :
                                                          'bg-gray-100 text-gray-800'
                                                        }`}>
                                                          {detail.transactionType}
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-2 text-xs">{detail.sku}</td>
                                                      <td className="px-3 py-2 text-xs">{detail.batchLot}</td>
                                                      <td className="px-3 py-2 text-xs text-right">{detail.quantity}</td>
                                                      <td className="px-3 py-2 text-xs text-right">{formatCurrency(detail.unitRate || 0)}</td>
                                                      <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(detail.totalCost || 0)}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12">
                      <EmptyState
                        icon={DollarSign}
                        title="No costs found"
                        description="No cost data found for the selected period and filters."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}