'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter, Download, Package2, Calendar, AlertCircle, BookOpen, Package, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, BarChart3, X, Info } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ImmutableLedgerNotice } from '@/components/ui/immutable-ledger-notice'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { InventoryTabs } from '@/components/operations/inventory-tabs'
import { IncompleteTransactionsAlert } from '@/components/operations/incomplete-transactions-alert'
import { Tooltip } from '@/components/ui/tooltip'

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
    endDate: '',
    minCartons: '',
    maxCartons: '',
    showLowStock: false,
    showZeroStock: false,
    showMissingAttributes: false
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
      const balancesCacheKey = 'live'
      const transactionsCacheKey = 'live'
      
      // Check if we have cached data for the current tab
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
        const balancesUrl = '/api/inventory/balances'
        
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
        const transactionsUrl = '/api/transactions/ledger'
        
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
          const url = '/api/inventory/balances'
          
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
          const url = '/api/transactions/ledger'
          
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
  }, [activeTab, warehouses.length, hasInitialized])

  // Initial load
  useEffect(() => {
    if (!hasInitialized) {
      fetchData(true)
    }
  }, [hasInitialized, fetchData])
  
  
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
      if (filters.endDate && transactionDate > new Date(filters.endDate)) return false

      if (filters.showMissingAttributes) {
        const missing = getMissingAttributes(transaction)
        if (missing.length === 0) return false
      }

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
        warehouse: filters.warehouse,
        transactionType: filters.transactionType,
        endDate: filters.endDate,
        minCartons: filters.minCartons,
        maxCartons: filters.maxCartons,
        showLowStock: String(filters.showLowStock),
        showZeroStock: String(filters.showZeroStock)
      })
      window.open(`/api/export/ledger?${params}`, '_blank')
    }
  }

  const handleTabChange = (tab: 'balances' | 'transactions') => {
    setActiveTab(tab)
  }

  // Check if transaction has missing required attributes
  const getMissingAttributes = (transaction: Transaction) => {
    const missing: string[] = []
    
    if (transaction.transactionType === 'RECEIVE') {
      if (!transaction.containerNumber) missing.push('Container #')
      if (!transaction.attachments) missing.push('Attachments')
    } else if (transaction.transactionType === 'SHIP') {
      if (!transaction.pickupDate) missing.push('Pickup Date')
      if (!transaction.shipName) missing.push('Destination')
      if (!transaction.attachments) missing.push('Attachments')
    }
    
    return missing
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
          description="This combines the Excel Inventory Ledger (all movements) and calculated balances. Use the tabs to switch between the full inventory ledger and current inventory balances."
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

        {/* Incomplete Transactions Alert */}
        <IncompleteTransactionsAlert />

        {/* Tab Navigation */}
        <InventoryTabs activeTab={activeTab} onTabChange={handleTabChange} />


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
                      <label className="block text-sm font-medium mb-1">
                        <div className="flex items-center gap-1">
                          End Date
                          <Tooltip 
                            content="Filter transactions up to this date. This also affects the Current Balances tab by only showing stock levels as of this date." 
                            iconSize="sm"
                          />
                        </div>
                      </label>
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

                {activeTab === 'transactions' && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.showMissingAttributes}
                        onChange={(e) => setFilters({...filters, showMissingAttributes: e.target.checked})}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Missing Attributes Only</span>
                    </label>
                  </div>
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
                      endDate: '',
                      minCartons: '',
                      maxCartons: '',
                      showLowStock: false,
                      showZeroStock: false,
                      showMissingAttributes: false
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
          
          {/* Reconciliation Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-medium text-blue-900">About Transaction Status</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Reconciled:</strong> Transaction has been verified against warehouse invoices and billing records. This confirms the transaction was properly billed and paid for.</p>
                  <p><strong>Unreconciled:</strong> Transaction has not yet been matched with warehouse invoices. This is normal for recent transactions that haven't been billed yet.</p>
                  <p className="text-xs mt-2">Note: Currently all transactions show as unreconciled. The reconciliation process happens during invoice processing in the Finance module.</p>
                </div>
              </div>
            </div>
          </div>
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
                  Current stock levels by Warehouse, SKU, and Batch/Lot
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
            <div className="grid gap-4 md:grid-cols-5">
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
              <div className="border rounded-lg p-4 bg-yellow-50">
                <p className="text-sm text-yellow-800">Missing Attributes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredAndSortedTransactions.filter(t => getMissingAttributes(t).length > 0).length.toLocaleString()}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  {Math.round((filteredAndSortedTransactions.filter(t => getMissingAttributes(t).length > 0).length / filteredAndSortedTransactions.length) * 100)}% incomplete
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
                      All inventory movements in chronological order • Click any transaction to view details or add missing attributes
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Missing Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedTransactions.map((transaction) => {
                      const missingAttributes = getMissingAttributes(transaction)
                      const hasMissingData = missingAttributes.length > 0
                      
                      return (
                      <tr 
                        key={transaction.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${hasMissingData ? 'bg-yellow-50' : ''}`}
                        onClick={() => router.push(`/operations/transactions/${transaction.id}`)}>
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
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {transaction.createdBy.fullName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="max-w-xs truncate" title={transaction.notes || ''}>
                            {transaction.notes || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {missingAttributes.length > 0 ? (
                            <div className="space-y-1">
                              {missingAttributes.map((attr, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mr-1">
                                  {attr}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Complete
                            </span>
                          )}
                        </td>
                      </tr>
                      )
                    })}
                    {filteredAndSortedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={17} className="px-6 py-12">
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