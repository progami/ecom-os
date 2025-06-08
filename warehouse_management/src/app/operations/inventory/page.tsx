'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, Download, Package2, Calendar, Eye, Clock, AlertCircle, BookOpen, Package, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, BarChart3, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ImmutableLedgerNotice } from '@/components/ui/immutable-ledger-notice'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { InventoryTabs } from '@/components/operations/inventory-tabs'

interface InventoryBalance {
  id: string
  warehouse: { id: string; name: string }
  sku: { id: string; skuCode: string; description: string }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  lastTransactionDate: string | null
}

interface Transaction {
  id: string
  transactionId: string
  transactionDate: string
  pickupDate: string | null
  isReconciled: boolean
  transactionType: 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'
  warehouse: { id: string; name: string }
  sku: { id: string; skuCode: string; description: string; unitsPerCarton: number }
  batchLot: string
  referenceId: string
  cartonsIn: number
  cartonsOut: number
  storagePalletsIn: number
  shippingPalletsOut: number
  notes: string | null
  createdBy: { id: string; fullName: string }
  createdAt: string
  runningBalance?: number
  shipName?: string | null
  containerNumber?: string | null
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
}

export default function UnifiedInventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions'>('transactions')
  const [viewMode, setViewMode] = useState<'live' | 'point-in-time'>('live')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // Default: latest first
  
  
  
  // Data states
  const [inventoryData, setInventoryData] = useState<InventoryBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [warehouses, setWarehouses] = useState<{id: string; name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [dataCache, setDataCache] = useState<{
    balances?: { data: InventoryBalance[], key: string },
    transactions?: { data: Transaction[], key: string }
  }>({})
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    warehouse: '',
    transactionType: '',
    startDate: '',
    endDate: '',
    minCartons: '',
    maxCartons: '',
    showLowStock: false,
    showZeroStock: false
  })

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

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      // Generate cache keys based on current state
      const balancesCacheKey = `${viewMode}-${selectedDate}`
      const transactionsCacheKey = `${viewMode}-${selectedDate}`
      
      // Check if we have cached data for the current tab and haven't changed view/date
      if (!forceRefresh && hasInitialized) {
        if (activeTab === 'balances' && dataCache.balances?.key === balancesCacheKey) {
          setInventoryData(dataCache.balances.data)
          return
        }
        if (activeTab === 'transactions' && dataCache.transactions?.key === transactionsCacheKey) {
          setTransactions(dataCache.transactions.data)
          return
        }
      }
      
      // Only show loading on first load
      if (!hasInitialized) {
        setLoading(true)
      }
      
      // Fetch warehouses on first load
      if (warehouses.length === 0) {
        const warehouseResponse = await fetch('/api/warehouses')
        if (warehouseResponse.ok) {
          const warehouseData = await warehouseResponse.json()
          setWarehouses(warehouseData)
        }
      }
      
      // Always fetch both tabs on initial load
      if (!hasInitialized) {
        // Fetch inventory balances
        const balancesUrl = viewMode === 'point-in-time' 
          ? `/api/inventory/balances?date=${selectedDate}`
          : '/api/inventory/balances'
        
        console.log('Fetching balances from:', balancesUrl)
        const balancesResponse = await fetch(balancesUrl)
        if (balancesResponse.ok) {
          const balancesData = await balancesResponse.json()
          setInventoryData(balancesData)
          setDataCache(prev => ({
            ...prev,
            balances: { data: balancesData, key: balancesCacheKey }
          }))
        }
        
        // Fetch transactions
        const transactionsUrl = viewMode === 'point-in-time'
          ? `/api/transactions/ledger?date=${selectedDate}`
          : '/api/transactions/ledger'
        
        const transactionsResponse = await fetch(transactionsUrl)
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json()
          setTransactions(transactionsData.transactions)
          setDataCache(prev => ({
            ...prev,
            transactions: { data: transactionsData.transactions, key: transactionsCacheKey }
          }))
        }
        
        setHasInitialized(true)
      } else {
        // After initialization, only fetch the active tab
        if (activeTab === 'balances') {
          const url = viewMode === 'point-in-time' 
            ? `/api/inventory/balances?date=${selectedDate}`
            : '/api/inventory/balances'
          
          console.log('Fetching balances from:', url)
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            setInventoryData(data)
            setDataCache(prev => ({
              ...prev,
              balances: { data, key: balancesCacheKey }
            }))
          }
        } else if (activeTab === 'transactions') {
          const url = viewMode === 'point-in-time'
            ? `/api/transactions/ledger?date=${selectedDate}`
            : '/api/transactions/ledger'
          
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            setTransactions(data.transactions)
            setDataCache(prev => ({
              ...prev,
              transactions: { data: data.transactions, key: transactionsCacheKey }
            }))
          }
        }
      }
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      if (!hasInitialized) {
        setLoading(false)
      }
    }
  }, [activeTab, viewMode, selectedDate, warehouses.length, hasInitialized])

  // Initial load
  useEffect(() => {
    if (!hasInitialized) {
      fetchData(true)
    }
  }, [hasInitialized, fetchData])
  
  // Refetch when view mode or date changes
  useEffect(() => {
    if (hasInitialized) {
      // Clear cache when view mode or date changes to force fresh data
      setDataCache({})
      fetchData(true)
    }
  }, [viewMode, selectedDate, fetchData, hasInitialized])
  
  // Handle tab changes
  useEffect(() => {
    if (hasInitialized) {
      // Use cached data if available, otherwise fetch
      fetchData(false)
    }
  }, [activeTab, hasInitialized, fetchData])

  // Filter inventory data
  const filteredInventory = inventoryData.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!item.sku.skuCode.toLowerCase().includes(query) &&
          !item.sku.description.toLowerCase().includes(query) &&
          !item.batchLot.toLowerCase().includes(query) &&
          !item.warehouse.name.toLowerCase().includes(query)) {
        return false
      }
    }

    if (filters.warehouse && item.warehouse.id !== filters.warehouse) return false
    if (filters.minCartons && item.currentCartons < Number.parseInt(filters.minCartons)) return false
    if (filters.maxCartons && item.currentCartons > Number.parseInt(filters.maxCartons)) return false
    if (filters.showLowStock && (item.currentCartons >= 10 || item.currentCartons === 0)) return false
    if (filters.showZeroStock && item.currentCartons !== 0) return false

    return true
  })

  // Filter and sort transactions
  const filteredAndSortedTransactions = transactions
    .filter(transaction => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!transaction.sku.skuCode.toLowerCase().includes(query) &&
            !transaction.sku.description.toLowerCase().includes(query) &&
            !transaction.batchLot.toLowerCase().includes(query) &&
            !transaction.referenceId.toLowerCase().includes(query) &&
            !transaction.warehouse.name.toLowerCase().includes(query) &&
            !(transaction.shipName?.toLowerCase().includes(query)) &&
            !(transaction.containerNumber?.toLowerCase().includes(query))) {
          return false
        }
      }

      if (filters.warehouse && transaction.warehouse.id !== filters.warehouse) return false
      if (filters.transactionType && transaction.transactionType !== filters.transactionType) return false
      
      const transactionDate = new Date(transaction.transactionDate)
      if (filters.startDate && transactionDate < new Date(filters.startDate)) return false
      if (filters.endDate && transactionDate > new Date(filters.endDate)) return false

      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.transactionDate).getTime()
      const dateB = new Date(b.transactionDate).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

  const handleExport = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (activeTab === 'balances') {
      toast.success('Exporting inventory balances...')
      window.open('/api/export/inventory', '_blank')
    } else {
      const params = new URLSearchParams({
        viewMode,
        ...(viewMode === 'point-in-time' && { date: selectedDate }),
        warehouse: filters.warehouse,
        transactionType: filters.transactionType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        minCartons: filters.minCartons,
        maxCartons: filters.maxCartons,
        showLowStock: String(filters.showLowStock),
        showZeroStock: String(filters.showZeroStock)
      })
      window.open(`/api/export/ledger?${params}`, '_blank')
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
  }
  
  const handleTabChange = (tab: 'balances' | 'transactions') => {
    setActiveTab(tab)
  }


  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'RECEIVE': return 'bg-green-100 text-green-800'
      case 'SHIP': return 'bg-red-100 text-red-800'
      case 'ADJUST_IN': return 'bg-blue-100 text-blue-800'
      case 'ADJUST_OUT': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate summary stats
  const totalCartons = filteredInventory.reduce((sum, item) => sum + item.currentCartons, 0)
  const totalPallets = filteredInventory.reduce((sum, item) => sum + item.currentPallets, 0)
  const uniqueSkus = new Set(filteredInventory.map(item => item.sku.id)).size
  const lowStockItems = filteredInventory.filter(item => item.currentCartons < 10 && item.currentCartons > 0).length

  if (loading) {
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
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Inventory Ledger & Balances"
          subtitle="Inventory movements and current stock levels"
          description="This combines the Excel Inventory Ledger (all movements) and calculated balances. Use the tabs to switch between the full inventory ledger and current inventory balances. Point-in-time view lets you see historical stock levels."
          icon={BookOpen}
          iconColor="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-800"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/operations/receive"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <Package2 className="h-4 w-4 mr-2" />
                Receive Goods
              </Link>
              <Link
                href="/operations/ship"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <Package2 className="h-4 w-4 mr-2" />
                Ship Goods
              </Link>
              <button 
                type="button"
                onClick={handleExport}
                className="secondary-button"
                title="Export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <InventoryTabs activeTab={activeTab} onTabChange={handleTabChange} />

        {/* View Mode Controls */}
        <div className="bg-white border rounded-lg">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">View Mode:</label>
                <div className="flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setViewMode('live')
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                      viewMode === 'live'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Eye className="h-4 w-4 inline mr-2" />
                    Live View
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setViewMode('point-in-time')
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                      viewMode === 'point-in-time'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Clock className="h-4 w-4 inline mr-2" />
                    Point-in-Time
                  </button>
                </div>
              </div>

              {viewMode === 'point-in-time' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">As of Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {viewMode === 'point-in-time' && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Point-in-Time View Active</p>
                    <p>
                      {activeTab === 'balances' 
                        ? `Showing inventory balances as of ${new Date(selectedDate).toLocaleDateString('en-US', { 
                            timeZone: 'America/Chicago',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })} 11:59:59 PM CT.`
                        : `Showing all inventory movements up to ${new Date(selectedDate).toLocaleDateString('en-US', { 
                            timeZone: 'America/Chicago',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })} 11:59:59 PM CT with running balances.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'balances' 
                    ? "Search by SKU, description, batch, or warehouse..."
                    : "Search by SKU, description, batch, reference, warehouse, ship, or container..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowFilters(!showFilters)
              }}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${
                showFilters 
                  ? 'border-primary bg-primary text-white' 
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters {Object.values(filters).some(v => v) && '•'}
            </button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                
                {activeTab === 'transactions' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Transaction Type</label>
                      <select
                        value={filters.transactionType}
                        onChange={(e) => setFilters({...filters, transactionType: e.target.value})}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">All Types</option>
                        <option value="RECEIVE">Receive</option>
                        <option value="SHIP">Ship</option>
                        <option value="ADJUST_IN">Adjust In</option>
                        <option value="ADJUST_OUT">Adjust Out</option>
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
                  </>
                )}

                {activeTab === 'balances' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Min Cartons</label>
                      <input
                        type="number"
                        value={filters.minCartons}
                        onChange={(e) => setFilters({...filters, minCartons: e.target.value})}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Cartons</label>
                      <input
                        type="number"
                        value={filters.maxCartons}
                        onChange={(e) => setFilters({...filters, maxCartons: e.target.value})}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="999999"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.showLowStock}
                          onChange={(e) => setFilters({...filters, showLowStock: e.target.checked})}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Low Stock Only</span>
                      </label>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.showZeroStock}
                          onChange={(e) => setFilters({...filters, showZeroStock: e.target.checked})}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Zero Stock Only</span>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setFilters({
                      warehouse: '',
                      transactionType: '',
                      startDate: '',
                      endDate: '',
                      minCartons: '',
                      maxCartons: '',
                      showLowStock: false,
                      showZeroStock: false
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

        {/* Show immutable notice for ledger tab */}
        <div className={activeTab === 'transactions' ? '' : 'hidden'}>
          <ImmutableLedgerNotice />
        </div>

        {/* Content based on active tab */}
        <div className={activeTab === 'balances' ? '' : 'hidden'}>
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryCard
                title="Total SKUs"
                value={uniqueSkus.toString()}
                icon={Package2}
                subtitle={`${filteredInventory.length} items`}
              />
              <SummaryCard
                title="Total Cartons"
                value={totalCartons.toLocaleString()}
                icon={Package2}
              />
              <SummaryCard
                title="Total Pallets"
                value={totalPallets.toString()}
                icon={Package2}
                subtitle="Active storage"
              />
              <SummaryCard
                title="Low Stock Items"
                value={lowStockItems.toString()}
                icon={AlertCircle}
                highlight={lowStockItems > 0}
                subtitle="< 10 cartons"
              />
            </div>

            {/* Inventory Balance Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h3 className="text-lg font-semibold">Inventory Balance Details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {viewMode === 'live' 
                    ? 'Current stock levels by Warehouse, SKU, and Batch/Lot'
                    : `Stock levels as of ${new Date(selectedDate).toLocaleDateString()}`}
                </p>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Warehouse
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch/Lot
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cartons
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pallet Config
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pallets
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInventory.map((balance) => {
                    const isLowStock = balance.currentCartons < 10 && balance.currentCartons > 0
                    const isZeroStock = balance.currentCartons === 0
                    
                    return (
                      <tr key={balance.id} className={`hover:bg-gray-50 transition-colors ${
                        isZeroStock ? 'bg-red-50' : isLowStock ? 'bg-orange-50' : ''
                      }`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {balance.warehouse.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {balance.sku.skuCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {balance.sku.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {balance.batchLot}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isZeroStock && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Out
                              </span>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Low
                              </span>
                            )}
                            <span className={`font-medium ${
                              isZeroStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              {balance.currentCartons.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs text-gray-600">
                            {balance.storageCartonsPerPallet && balance.shippingCartonsPerPallet ? (
                              <div className="space-y-1">
                                <div title="Storage cartons per pallet">
                                  S: {balance.storageCartonsPerPallet}/pallet
                                </div>
                                <div title="Shipping cartons per pallet">
                                  P: {balance.shippingCartonsPerPallet}/pallet
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {balance.currentPallets}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {balance.currentUnits.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {balance.lastTransactionDate
                            ? new Date(balance.lastTransactionDate).toLocaleDateString('en-US', {
                                timeZone: 'America/Chicago',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'No activity'}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12">
                        <EmptyState
                          icon={Package2}
                          title={searchQuery || Object.values(filters).some(v => v) 
                            ? "No inventory items match your filters" 
                            : "No inventory found"}
                          description={searchQuery || Object.values(filters).some(v => v)
                            ? "Try adjusting your search criteria or filters to find what you're looking for."
                            : "Start by receiving new inventory or importing existing stock data."}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </>
        </div>

        <div className={activeTab === 'transactions' ? '' : 'hidden'}>
          <>
            {/* Transaction Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{filteredAndSortedTransactions.length.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Receipts</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredAndSortedTransactions.filter(t => t.transactionType === 'RECEIVE').length.toLocaleString()}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Shipments</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredAndSortedTransactions.filter(t => t.transactionType === 'SHIP').length.toLocaleString()}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Adjustments</p>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredAndSortedTransactions.filter(t => t.transactionType.startsWith('ADJUST')).length.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Inventory Ledger Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Inventory Ledger Details</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {viewMode === 'live' 
                        ? 'All inventory movements in chronological order' 
                        : `Inventory movements up to ${new Date(selectedDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    Sorted: <span className="font-medium">{sortOrder === 'desc' ? 'Latest → Oldest' : 'Oldest → Latest'}</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                          }}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          Creation Date
                          {sortOrder === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pickup Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Warehouse
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Batch/Lot
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cartons
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pallets
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Units
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ship/Container
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pallet Config
                      </th>
                      {viewMode === 'point-in-time' && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-900">
                            {new Date(transaction.transactionDate).toLocaleDateString('en-US', {
                              timeZone: 'America/Chicago',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(transaction.transactionDate).toLocaleTimeString('en-US', {
                              timeZone: 'America/Chicago',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {transaction.pickupDate ? (
                            <div>
                              <div className="text-gray-900">
                                {new Date(transaction.pickupDate).toLocaleDateString('en-US', {
                                  timeZone: 'America/Chicago',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(transaction.pickupDate).toLocaleTimeString('en-US', {
                                  timeZone: 'America/Chicago',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {transaction.isReconciled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Reconciled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Unreconciled
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            getTransactionColor(transaction.transactionType)
                          }`}>
                            {transaction.transactionType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {transaction.warehouse.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-gray-900">{transaction.sku.skuCode}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]" title={transaction.sku.description}>
                              {transaction.sku.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {transaction.batchLot}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {transaction.referenceId}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="space-y-1">
                            {transaction.cartonsIn > 0 && (
                              <div className="text-green-600 font-medium">
                                +{transaction.cartonsIn.toLocaleString()}
                              </div>
                            )}
                            {transaction.cartonsOut > 0 && (
                              <div className="text-red-600 font-medium">
                                -{transaction.cartonsOut.toLocaleString()}
                              </div>
                            )}
                            {transaction.cartonsIn === 0 && transaction.cartonsOut === 0 && (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="space-y-1">
                            {transaction.storagePalletsIn > 0 && (
                              <div className="text-green-600 font-medium">
                                +{transaction.storagePalletsIn}
                              </div>
                            )}
                            {transaction.shippingPalletsOut > 0 && (
                              <div className="text-red-600 font-medium">
                                -{transaction.shippingPalletsOut}
                              </div>
                            )}
                            {transaction.storagePalletsIn === 0 && transaction.shippingPalletsOut === 0 && (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="space-y-1">
                            {transaction.cartonsIn > 0 && (
                              <div className="text-green-600 font-medium">
                                +{(transaction.cartonsIn * (transaction.sku?.unitsPerCarton || 1)).toLocaleString()}
                              </div>
                            )}
                            {transaction.cartonsOut > 0 && (
                              <div className="text-red-600 font-medium">
                                -{(transaction.cartonsOut * (transaction.sku?.unitsPerCarton || 1)).toLocaleString()}
                              </div>
                            )}
                            {transaction.cartonsIn === 0 && transaction.cartonsOut === 0 && (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(transaction.shipName || transaction.containerNumber) ? (
                            <div className="text-xs">
                              {transaction.shipName && (
                                <div className="text-gray-700" title="Ship Name">
                                  {transaction.shipName}
                                </div>
                              )}
                              {transaction.containerNumber && (
                                <div className="text-gray-500" title="Container Number">
                                  {transaction.containerNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-xs text-gray-600">
                            {(transaction.storageCartonsPerPallet || transaction.shippingCartonsPerPallet) ? (
                              <div className="space-y-1">
                                {transaction.storageCartonsPerPallet && (
                                  <div title="Storage cartons per pallet">
                                    S: {transaction.storageCartonsPerPallet}
                                  </div>
                                )}
                                {transaction.shippingCartonsPerPallet && (
                                  <div title="Shipping cartons per pallet">
                                    P: {transaction.shippingCartonsPerPallet}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        {viewMode === 'point-in-time' && (
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            {transaction.runningBalance?.toLocaleString() || '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {transaction.createdBy.fullName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="max-w-xs truncate" title={transaction.notes || ''}>
                            {transaction.notes || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAndSortedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={viewMode === 'point-in-time' ? 17 : 16} className="px-6 py-12">
                          <EmptyState
                            icon={Calendar}
                            title="No transactions found"
                            description={searchQuery || Object.values(filters).some(v => v)
                              ? "Try adjusting your search criteria or filters."
                              : "No inventory transactions have been recorded yet."}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        </div>


        {/* Results Summary */}
        <div>
          <div className="text-sm text-gray-700">
            {activeTab === 'balances' ? (
              <div className="flex items-center justify-between">
                <div>
                  Showing <span className="font-medium">{filteredInventory.length}</span> of{' '}
                  <span className="font-medium">{inventoryData.length}</span> inventory items
                </div>
                {filteredInventory.length > 0 && (
                  <div className="text-gray-500">
                    Stock indicators: <span className="text-red-600">• Out</span> = 0 cartons, <span className="text-orange-600">• Low</span> = &lt;10 cartons
                  </div>
                )}
              </div>
            ) : (
              <span>
                Showing <span className="font-medium">{filteredAndSortedTransactions.length}</span> of{' '}
                <span className="font-medium">{transactions.length}</span> transactions
                <span className="text-xs text-gray-500 ml-2">
                  ({sortOrder === 'desc' ? 'Latest first' : 'Oldest first'})
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

    </DashboardLayout>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  icon: React.ElementType
  subtitle?: string
  highlight?: boolean
}

function SummaryCard({ title, value, icon: Icon, subtitle, highlight }: SummaryCardProps) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${
      highlight ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${
            highlight ? 'text-orange-600' : ''
          }`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <Icon className={`h-8 w-8 ${
          highlight ? 'text-orange-400' : 'text-gray-400'
        }`} />
      </div>
    </div>
  )
}