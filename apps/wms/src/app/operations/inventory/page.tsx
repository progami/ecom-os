'use client'

import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClientLogger } from '@/hooks/useClientLogger'
import { Search, Filter, Download, Package2, Calendar, AlertCircle, BookOpen, Package, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Truck } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LedgerInfoTooltip } from '@/components/ui/ledger-info-tooltip'
import { toast } from 'react-hot-toast'
import { InventoryTabs } from '@/components/operations/inventory-tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { ImportButton } from '@/components/ui/import-button'
import { getUIColumns, getBalanceUIColumns } from '@/lib/column-ordering'
import { formatDateGMT } from '@/lib/date-utils'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'

interface InventoryBalance {
  id: string
  warehouse: { id: string; name: string }
  sku: { id: string; skuCode: string; description: string; unitsPerCarton: number }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  lastTransactionDate: string | null
  receiveTransaction?: {
    createdBy: { fullName: string }
    transactionDate: string
  }
}

interface Transaction {
  id: string
  transactionDate: string
  pickupDate: string | null
  isReconciled: boolean
  transactionType: 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'
  warehouse: { id: string; name: string }
  sku: { id: string; skuCode: string; description: string; unitsPerCarton: number }
  batchLot: string
  referenceId: string | null
  cartonsIn: number
  cartonsOut: number
  storagePalletsIn: number
  shippingPalletsOut: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  shipName: string | null
  trackingNumber: string | null
  attachments: Record<string, unknown> | null
  createdBy: { id: string; fullName: string }
  createdAt: string
  runningBalance?: number
  unitsPerCarton?: number | null
}

export default function UnifiedInventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { logAction, logPerformance, logError } = useClientLogger()
  const [activeTab, setActiveTab] = useState<'balances' | 'transactions'>('transactions')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // Default: latest first
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [balanceView, setBalanceView] = useState<'sku' | 'batch'>('sku') // Default to SKU view for better overview
  
  
  
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
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [filters, setFilters] = useState({
    warehouse: '',
    transactionType: '',
    endDate: '',
    minCartons: '',
    maxCartons: '',
    showLowStock: false,
    showZeroStock: false,
    showIncomplete: false
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', window.location.origin + '/operations/inventory')
      window.location.href = url.toString()
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  const fetchData = useCallback(async (forceRefresh = false) => {
    const startTime = performance.now()
    
    try {
      logAction('inventory_data_fetch_started', {
        activeTab,
        forceRefresh,
        hasInitialized
      })
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
        const warehouseResponse = await fetch('/api/warehouses', {
          credentials: 'include'
        })
        if (warehouseResponse.ok) {
          const warehouseData = await warehouseResponse.json()
          setWarehouses(warehouseData)
        }
      }
      
      // Always fetch both tabs on initial load
      if (!hasInitialized) {
        // Fetch inventory balances
        const balancesUrl = '/api/inventory/balances'
        
        const balancesResponse = await fetch(balancesUrl, {
          credentials: 'include'
        })
        if (balancesResponse.ok) {
          const balancesResult = await balancesResponse.json()
          // Handle paginated response
          const balancesData = Array.isArray(balancesResult) ? balancesResult : (balancesResult.data || [])
          setInventoryData(balancesData)
          setDataCache(prev => ({
            ...prev,
            balances: { data: balancesData, key: balancesCacheKey }
          }))
        }
        
        // Fetch transactions
        const transactionsUrl = '/api/transactions/ledger'
        
        const transactionsResponse = await fetch(transactionsUrl, {
          credentials: 'include'
        })
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json()
          setTransactions(transactionsData.transactions)
          setDataCache(prev => ({
            ...prev,
            transactions: { data: transactionsData.transactions, key: transactionsCacheKey }
          }))
        }
        
        setHasInitialized(true)
      
      const duration = performance.now() - startTime
      logPerformance('inventory_initial_load', duration, {
        balanceCount: inventoryData.length,
        transactionCount: transactions.length
      })
      
      // Log slow page warning if load took > 2 seconds
      if (duration > 2000) {
        logAction('slow_page_load_detected', {
          page: 'inventory',
          duration,
          activeTab
        })
      }
      } else {
        // After initialization, only fetch the active tab
        if (activeTab === 'balances') {
          // Fetch inventory balances
          const url = '/api/inventory/balances'
          
          const response = await fetch(url, {
            credentials: 'include'
          })
          if (response.ok) {
            const result = await response.json()
            // Handle paginated response
            const data = Array.isArray(result) ? result : (result.data || [])
            setInventoryData(data)
            setDataCache(prev => ({
              ...prev,
              balances: { data, key: balancesCacheKey }
            }))
          }
        } else if (activeTab === 'transactions') {
          const url = '/api/transactions/ledger'
          
          const response = await fetch(url, {
            credentials: 'include'
          })
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
    } catch (_error) {
      const duration = performance.now() - startTime
      logError('Failed to load inventory data', _error)
      logPerformance('inventory_data_fetch_error', duration)
      
      toast.error('Failed to load data')
    } finally {
      if (!hasInitialized) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, warehouses.length, hasInitialized, logAction, logPerformance, logError])

  // Initial load
  useEffect(() => {
    if (!hasInitialized) {
      fetchData(true)
    }
  }, [hasInitialized, fetchData])
  
  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest('.relative')) {
        setShowExportMenu(false)
      }
    }
    
    if (showExportMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showExportMenu])
  
  
  // Handle tab changes
  useEffect(() => {
    if (hasInitialized) {
      // Use cached data if available, otherwise fetch
      fetchData(false)
    }
  }, [activeTab, hasInitialized, fetchData])

  // Refresh data when page becomes visible (user returns from transaction detail)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && hasInitialized) {
        // Just fetch fresh data when page becomes visible
        fetchData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refresh on focus
    const handleFocus = () => {
      if (hasInitialized) {
        fetchData(true)
      }
    }
    window.addEventListener('focus', handleFocus)
    
    // Also listen for navigation back
    const handlePopState = () => {
      if (hasInitialized) {
        fetchData(true)
      }
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasInitialized, fetchData])

  // Aggregate inventory by SKU globally
  const inventoryBySku = useMemo(() => {
    if (!Array.isArray(inventoryData)) return []
    
    const skuMap = new Map<string, {
      sku: { skuCode: string; description: string }
      currentCartons: number
      currentPallets: number
      currentUnits: number
      lastReceived: Date | null
      lastShipped: Date | null
      batchLots: string[]
    }>()
    
    inventoryData.forEach(item => {
      const key = item.sku.skuCode
      const existing = skuMap.get(key)
      
      if (existing) {
        existing.currentCartons += item.currentCartons
        existing.currentPallets += item.currentPallets
        existing.currentUnits += item.currentUnits
        existing.batchCount += 1
        
        // Track warehouse breakdown
        const warehouseKey = item.warehouse.id
        if (existing.warehouseBreakdown[warehouseKey]) {
          existing.warehouseBreakdown[warehouseKey].currentCartons += item.currentCartons
          existing.warehouseBreakdown[warehouseKey].currentPallets += item.currentPallets
          existing.warehouseBreakdown[warehouseKey].currentUnits += item.currentUnits
          existing.warehouseBreakdown[warehouseKey].batchCount += 1
        } else {
          existing.warehouseBreakdown[warehouseKey] = {
            warehouse: item.warehouse,
            currentCartons: item.currentCartons,
            currentPallets: item.currentPallets,
            currentUnits: item.currentUnits,
            batchCount: 1
          }
        }
        
        existing.warehouseCount = Object.keys(existing.warehouseBreakdown).length
        existing.lastTransactionDate = !existing.lastTransactionDate || 
          (item.lastTransactionDate && new Date(item.lastTransactionDate) > new Date(existing.lastTransactionDate))
          ? item.lastTransactionDate
          : existing.lastTransactionDate
      } else {
        skuMap.set(key, {
          id: key,
          sku: item.sku,
          currentCartons: item.currentCartons,
          currentPallets: item.currentPallets,
          currentUnits: item.currentUnits,
          batchCount: 1,
          warehouseCount: 1,
          warehouseBreakdown: {
            [item.warehouse.id]: {
              warehouse: item.warehouse,
              currentCartons: item.currentCartons,
              currentPallets: item.currentPallets,
              currentUnits: item.currentUnits,
              batchCount: 1
            }
          },
          lastTransactionDate: item.lastTransactionDate
        })
      }
    })
    
    return Array.from(skuMap.values())
  }, [inventoryData])
  
  // Filter inventory data
  const baseInventory = balanceView === 'sku' ? inventoryBySku : inventoryData
  const filteredInventory = Array.isArray(baseInventory) ? baseInventory.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (balanceView === 'sku') {
        // For SKU view, don't search by batch or warehouse name
        if (!item.sku.skuCode.toLowerCase().includes(query) &&
            !item.sku.description.toLowerCase().includes(query)) {
          return false
        }
      } else {
        // For batch view, search all fields
        if (!item.sku.skuCode.toLowerCase().includes(query) &&
            !item.sku.description.toLowerCase().includes(query) &&
            !item.batchLot.toLowerCase().includes(query) &&
            !item.warehouse.name.toLowerCase().includes(query)) {
          return false
        }
      }
    }

    // In SKU view, warehouse filter shows SKUs that have inventory in that warehouse
    if (filters.warehouse) {
      if (balanceView === 'sku') {
        if (!item.warehouseBreakdown || !item.warehouseBreakdown[filters.warehouse]) return false
      } else {
        if (item.warehouse.id !== filters.warehouse) return false
      }
    }
    if (filters.minCartons && item.currentCartons < Number.parseInt(filters.minCartons)) return false
    if (filters.maxCartons && item.currentCartons > Number.parseInt(filters.maxCartons)) return false
    if (filters.showLowStock && (item.currentCartons >= 10 || item.currentCartons === 0)) return false
    if (filters.showZeroStock && item.currentCartons !== 0) return false

    return true
  }) : []

  // Filter and sort transactions
  const filteredAndSortedTransactions = Array.isArray(transactions) ? transactions
    .filter(transaction => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!transaction.sku.skuCode.toLowerCase().includes(query) &&
            !transaction.sku.description.toLowerCase().includes(query) &&
            !transaction.batchLot.toLowerCase().includes(query) &&
            !(transaction.referenceId?.toLowerCase().includes(query)) &&
            !transaction.warehouse.name.toLowerCase().includes(query) &&
            !(transaction.shipName?.toLowerCase().includes(query)) &&
            !(transaction.trackingNumber?.toLowerCase().includes(query))) {
          return false
        }
      }

      if (filters.warehouse && transaction.warehouse.id !== filters.warehouse) return false
      if (filters.transactionType && transaction.transactionType !== filters.transactionType) return false
      
      const transactionDate = new Date(transaction.transactionDate)
      if (filters.endDate && transactionDate > new Date(filters.endDate)) return false

      if (filters.showIncomplete) {
        const missing = getMissingAttributes(transaction)
        if (missing.length === 0) return false
      }

      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.transactionDate).getTime()
      const dateB = new Date(b.transactionDate).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    }) : []

  const handleExport = (e?: React.MouseEvent, exportType: 'filtered' | 'full' = 'filtered') => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (activeTab === 'balances') {
      if (exportType === 'full') {
        toast.success('Exporting all inventory balances...')
        window.open('/api/export/inventory?full=true', '_blank')
      } else {
        toast.success('Exporting filtered inventory balances...')
        const params = new URLSearchParams({
          warehouse: filters.warehouse,
          minCartons: filters.minCartons,
          maxCartons: filters.maxCartons,
          showLowStock: String(filters.showLowStock),
          showZeroStock: String(filters.showZeroStock)
        })
        window.open(`/api/export/inventory?${params}`, '_blank')
      }
    } else {
      if (exportType === 'full') {
        toast.success('Exporting all transactions from database...')
        window.open('/api/export/ledger?full=true', '_blank')
      } else {
        toast.success('Exporting filtered transactions...')
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
  }

  const handleTabChange = (tab: 'balances' | 'transactions') => {
    setActiveTab(tab)
  }

  // Document requirements configuration - can be modified based on business needs
  const DOCUMENT_REQUIREMENTS = {
    RECEIVE: {
      documents: [
        { key: ['commercial_invoice', 'commercialInvoice'], label: 'Commercial Invoice', required: true },
        { key: ['bill_of_lading', 'billOfLading'], label: 'Bill of Lading', required: true },
        { key: ['packing_list', 'packingList'], label: 'Packing List', required: true },
        { key: ['delivery_note', 'deliveryNote'], label: 'Delivery Note', required: true },
        { key: ['cube_master', 'cubeMaster'], label: 'Cube Master', required: true },
        { key: ['transaction_certificate', 'transactionCertificate'], label: 'TC GRS', required: true },
        { key: ['custom_declaration', 'customDeclaration'], label: 'CDS', required: true },
        { key: ['additionalDocs'], label: 'Additional Docs', required: false }
      ],
      fields: [
        { 
          check: (tx: Transaction) => !tx.shipName && (tx.referenceId?.includes('OOCL') || tx.referenceId?.includes('MSC')),
          label: 'Ship Name'
        }
      ]
    },
    SHIP: {
      documents: [
        { key: ['packingList', 'packing_list'], label: 'Packing List', required: true },
        { key: ['deliveryNote', 'delivery_note'], label: 'Delivery Note', required: true }
      ],
      fields: [
        {
          check: (tx: Transaction) => !tx.trackingNumber && tx.referenceId?.includes('FBA'),
          label: 'FBA Tracking #'
        }
      ]
    },
    ADJUST_IN: {
      documents: [
        { key: ['proofOfPickup', 'proof_of_pickup'], label: 'Proof Document', required: true }
      ],
      fields: []
    },
    ADJUST_OUT: {
      documents: [
        { key: ['proofOfPickup', 'proof_of_pickup'], label: 'Proof Document', required: true }
      ],
      fields: []
    }
  }

  // Check if transaction has missing required attributes
  const getMissingAttributes = (transaction: Transaction) => {
    const missing: string[] = []
    const attachments = transaction.attachments || {}
    
    const requirements = DOCUMENT_REQUIREMENTS[transaction.transactionType as keyof typeof DOCUMENT_REQUIREMENTS]
    if (!requirements) return missing
    
    // Check required documents - simplified logic
    requirements.documents?.forEach(doc => {
      if (doc.required) {
        // Check if ANY of the possible keys exist in attachments
        const hasDocument = doc.key.some(k => {
          const hasKey = k in attachments && attachments[k as keyof typeof attachments] !== null
          return hasKey
        })
        if (!hasDocument) {
          missing.push(doc.label)
        }
      }
    })
    
    // Check required fields
    requirements.fields?.forEach(field => {
      if (field.check(transaction)) {
        missing.push(field.label)
      }
    })
    
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
  // In SKU view, each item IS a unique SKU. In batch view, count unique SKU codes
  const uniqueSkus = balanceView === 'sku' 
    ? filteredInventory.length 
    : new Set(filteredInventory.map(item => item.sku.skuCode)).size
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
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <PageHeader
          title="Inventory Ledger & Balances"
          subtitle="Inventory movements and current stock levels"
          icon={BookOpen}
          iconColor="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-800"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/operations/receive"
                className="inline-flex items-center h-10 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Receive Goods
              </Link>
              <Link
                href="/operations/ship"
                className="inline-flex items-center h-10 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                Ship Goods
              </Link>
              <ImportButton 
                entityName="inventoryTransactions" 
                onImportComplete={() => {
                  fetchData(true)
                }}
                buttonText="Import"
              />
              <div className="relative">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowExportMenu(!showExportMenu)
                  }}
                  className="secondary-button inline-flex items-center"
                  title="Export options"
                >
                  <Download className="h-4 w-4" />
                  <span className="ml-2">Export</span>
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Export Dropdown Menu */}
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu">
                      <button
                        type="button"
                        onClick={(e) => {
                          handleExport(e, 'filtered')
                          setShowExportMenu(false)
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        <Filter className="h-4 w-4 mr-2 text-gray-500" />
                        <div>
                          <div className="font-medium">Export Filtered View</div>
                          <div className="text-xs text-gray-500">Export only visible data</div>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          handleExport(e, 'full')
                          setShowExportMenu(false)
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        <Package2 className="h-4 w-4 mr-2 text-gray-500" />
                        <div>
                          <div className="font-medium">Export All Data</div>
                          <div className="text-xs text-gray-500">Export entire database</div>
                        </div>
                      </button>
                      
                      <div className="border-t border-gray-100"></div>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open('/api/export/missing-attributes', '_blank')
                          setShowExportMenu(false)
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />
                        <div>
                          <div className="font-medium">Missing Data Report</div>
                          <div className="text-xs text-gray-500">Export records with missing fields</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />

        {/* Tab Navigation */}
        <InventoryTabs activeTab={activeTab} onTabChange={handleTabChange} />


        {/* Filters */}
        <div className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <label htmlFor="inventory-search" className="sr-only">
                  {activeTab === 'balances' 
                    ? "Search inventory by SKU, description, batch, or warehouse"
                    : "Search transactions by SKU, description, batch, reference, warehouse, ship, or container"}
                </label>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="inventory-search"
                  name="search"
                  type="search"
                  placeholder={activeTab === 'balances' 
                    ? "Search by SKU, description, batch, or warehouse..."
                    : "Search by SKU, description, batch, reference, warehouse, ship, or container..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={activeTab === 'balances' 
                    ? "Search inventory by SKU, description, batch, or warehouse"
                    : "Search transactions by SKU, description, batch, reference, warehouse, ship, or container"}
                  aria-describedby="inventory-search-help"
                  aria-controls={activeTab === 'balances' ? 'inventory-table' : 'transactions-table'}
                />
                <span id="inventory-search-help" className="sr-only">
                  {activeTab === 'balances' 
                    ? "Filter the inventory table below by entering search terms"
                    : "Filter the transactions table below by entering search terms"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'balances' && (
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setBalanceView('sku')}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      balanceView === 'sku'
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By SKU
                  </button>
                  <button
                    onClick={() => setBalanceView('batch')}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      balanceView === 'batch'
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By Batch
                  </button>
                </div>
              )}
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
                        checked={filters.showIncomplete}
                        onChange={(e) => setFilters({...filters, showIncomplete: e.target.checked})}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Incomplete Only</span>
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
                      showIncomplete: false
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

        {/* Empty div for transactions tab - info moved to header */}
        <div className={activeTab === 'transactions' ? '' : 'hidden'}>
        </div>

        {/* Content based on active tab - Fill remaining space */}
        <div className={activeTab === 'balances' ? 'flex-1 min-h-0 flex flex-col space-y-4' : 'hidden'}>
            {/* Summary Cards - Using StatsCard */}
            <StatsCardGrid cols={4} gap="gap-1">
              <StatsCard
                title="Total SKUs"
                value={uniqueSkus}
                subtitle={balanceView === 'sku' 
                  ? (filteredInventory.length < inventoryBySku.length ? `${filteredInventory.length} of ${inventoryBySku.length} shown` : undefined)
                  : `${filteredInventory.length} batches`}
                icon={Package2}
                size="sm"
              />
              <StatsCard
                title="Total Cartons"
                value={totalCartons}
                icon={Package2}
                size="sm"
              />
              <StatsCard
                title="Total Pallets"
                value={totalPallets}
                subtitle={balanceView === 'batch' ? `${filteredInventory.filter(b => b.storageCartonsPerPallet).length} configured` : undefined}
                icon={Package2}
                size="sm"
              />
              <StatsCard
                title="Low Stock Items"
                value={lowStockItems}
                subtitle="< 10 cartons"
                icon={AlertCircle}
                variant={lowStockItems > 0 ? 'warning' : 'default'}
                size="sm"
              />
            </StatsCardGrid>

            {/* Inventory Balance Table - Fill remaining space */}
            <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Inventory Balance Details</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {balanceView === 'sku' 
                        ? 'Global stock levels by SKU with expandable warehouse breakdown'
                        : 'Current stock levels with batch-specific packaging configurations'
                      }
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{filteredInventory.length}</span> of{' '}
                    <span className="font-medium">{inventoryData.length}</span> inventory items
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {getBalanceUIColumns()
                      .filter(column => {
                        // Filter out batch-specific columns in SKU view
                        if (balanceView === 'sku') {
                          return !['batchLot', 'receivedBy', 'warehouse', 'storageCartonsPerPallet', 'shippingCartonsPerPallet'].includes(column.fieldName)
                        }
                        return true
                      })
                      .map((column) => {
                      // Add tooltip for pallet config columns
                      const isPalletConfig = column.fieldName === 'storageCartonsPerPallet' || column.fieldName === 'shippingCartonsPerPallet'
                      
                      // Adjust column headers based on view
                      let displayName = column.displayName
                      if (balanceView === 'sku') {
                        // Simplify headers in SKU view
                        if (column.fieldName === 'currentCartons') displayName = 'Total Cartons'
                        if (column.fieldName === 'currentPallets') displayName = 'Total Pallets'
                        if (column.fieldName === 'currentUnits') displayName = 'Total Units'
                      }
                      
                      return (
                        <th 
                          key={column.fieldName}
                          className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                            column.fieldName === 'currentCartons' || column.fieldName === 'currentPallets' || column.fieldName === 'currentUnits'
                              ? 'text-right'
                              : column.fieldName === 'storageCartonsPerPallet' || column.fieldName === 'shippingCartonsPerPallet'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          <div className={`flex items-center gap-1 ${
                            column.fieldName === 'currentCartons' || column.fieldName === 'currentPallets' || column.fieldName === 'currentUnits'
                              ? 'justify-end'
                              : column.fieldName === 'storageCartonsPerPallet' || column.fieldName === 'shippingCartonsPerPallet'
                              ? 'justify-center'
                              : ''
                          }`}>
                            {displayName}
                            {isPalletConfig && balanceView === 'batch' && (
                              <Tooltip 
                                content="Batch-specific pallet configuration. These values determine how cartons are palletized for this specific batch."
                                iconSize="sm"
                              />
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInventory.map((balance) => {
                    const isLowStock = balance.currentCartons < 10 && balance.currentCartons > 0
                    const isZeroStock = balance.currentCartons === 0
                    
                    const isExpanded = expandedRows.has(balance.id)
                    const isSKUView = balanceView === 'sku'
                    
                    return (
                      <React.Fragment key={balance.id}>
                      <tr 
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          isZeroStock ? 'bg-red-50' : isLowStock ? 'bg-orange-50' : ''
                        }`}
                        onClick={() => {
                          const newExpanded = new Set(expandedRows)
                          if (isExpanded) {
                            newExpanded.delete(balance.id)
                          } else {
                            newExpanded.add(balance.id)
                          }
                          setExpandedRows(newExpanded)
                        }}
                      >
                        {getBalanceUIColumns()
                          .filter(column => {
                            if (balanceView === 'sku') {
                              return !['batchLot', 'receivedBy', 'warehouse'].includes(column.fieldName)
                            }
                            return true
                          })
                          .filter(column => {
                            // Additional runtime filtering for SKU view
                            if (balanceView === 'sku') {
                              if (column.fieldName === 'storageCartonsPerPallet' || column.fieldName === 'shippingCartonsPerPallet') {
                                return false
                              }
                            }
                            return true
                          })
                          .map((column) => {
                            switch (column.fieldName) {
                              case 'warehouse':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                      {!isSKUView && (
                                        isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-gray-400" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-gray-400" />
                                        )
                                      )}
                                      {balance.warehouse.name}
                                    </div>
                                  </td>
                                )
                              
                              case 'sku':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                      {isSKUView && (
                                        isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-gray-400" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-gray-400" />
                                        )
                                      )}
                                      {balance.sku.skuCode}
                                    </div>
                                  </td>
                                )
                              
                              case 'skuDescription':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 text-sm text-gray-500">
                                    <div>
                                      {balance.sku.description}
                                      {isSKUView && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          {balance.batchCount} {balance.batchCount === 1 ? 'batch' : 'batches'} • 
                                          {balance.warehouseCount} {balance.warehouseCount === 1 ? 'warehouse' : 'warehouses'}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )
                              
                              case 'batchLot':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900 font-medium">{balance.batchLot}</span>
                                      {(balance.storageCartonsPerPallet || balance.shippingCartonsPerPallet) && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800" title="Has batch-specific pallet configuration">
                                          <Package2 className="h-3 w-3" />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )
                              
                              case 'currentCartons':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
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
                                )
                              
                              case 'storageCartonsPerPallet':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 text-center">
                                    {balance.storageCartonsPerPallet ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-sm font-medium text-gray-900">
                                          {balance.storageCartonsPerPallet}
                                        </span>
                                        <span className="text-xs text-gray-500">storage</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                )
                              
                              case 'shippingCartonsPerPallet':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 text-center">
                                    {balance.shippingCartonsPerPallet ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-sm font-medium text-gray-900">
                                          {balance.shippingCartonsPerPallet}
                                        </span>
                                        <span className="text-xs text-gray-500">shipping</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                )
                              
                              case 'currentPallets':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                    {balance.currentPallets}
                                  </td>
                                )
                              
                              case 'currentUnits':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                    {balance.currentUnits.toLocaleString()}
                                  </td>
                                )
                              
                              case 'unitsPerCarton':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {balance.sku.unitsPerCarton}
                                    </span>
                                  </td>
                                )
                              
                              case 'receivedBy':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {balance.receiveTransaction?.createdBy?.fullName || '-'}
                                  </td>
                                )
                              
                              case 'lastTransactionDate':
                                return (
                                  <td key={column.fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {balance.lastTransactionDate
                                      ? formatDateGMT(balance.lastTransactionDate)
                                      : 'No activity'}
                                  </td>
                                )
                              
                              default:
                                return <td key={column.fieldName} className="px-6 py-4 text-sm text-gray-500">-</td>
                            }
                          })}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={getBalanceUIColumns().filter(col => {
                            if (balanceView === 'sku') {
                              // In SKU view, exclude batch-specific columns
                              return !['batchLot', 'receivedBy', 'warehouse', 'storageCartonsPerPallet', 'shippingCartonsPerPallet'].includes(col.fieldName)
                            }
                            return true
                          }).length} className="px-6 py-4">
                            {isSKUView ? (
                              // SKU View: Show warehouse and batch breakdown
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Stock Distribution
                                  </h4>
                                  <div className="text-xs text-gray-500">
                                    {Object.keys(balance.warehouseBreakdown || {}).length} warehouses • 
                                    {' '}{balance.batchCount} total batches
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  {Object.values(balance.warehouseBreakdown || {}).map((wh, idx: number) => (
                                    <div key={wh.warehouse?.id || `warehouse-${idx}`} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                      <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-3 border-b border-gray-100">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                              <Package2 className="h-4 w-4 text-green-600" />
                                            </div>
                                            <div>
                                              <div className="font-semibold text-gray-900">{wh.warehouse.name}</div>
                                              <div className="text-xs text-gray-500">
                                                {wh.batchCount} {wh.batchCount === 1 ? 'batch' : 'batches'} in stock
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <div className="text-lg font-bold text-gray-900">{wh.currentCartons.toLocaleString()}</div>
                                              <div className="text-xs text-gray-500">cartons</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-lg font-bold text-gray-900">{wh.currentPallets}</div>
                                              <div className="text-xs text-gray-500">pallets</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-lg font-bold text-gray-900">{wh.currentUnits.toLocaleString()}</div>
                                              <div className="text-xs text-gray-500">units</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      {/* Show batch details for this warehouse */}
                                      <div className="px-4 py-2 bg-gray-50/50">
                                        <div className="text-xs text-gray-600 mb-2">Batch Details:</div>
                                        <div className="space-y-1">
                                          {inventoryData
                                            .filter(item => item.warehouse.id === wh.warehouse.id && item.sku.skuCode === balance.sku.skuCode)
                                            .map(batch => (
                                              <div key={batch.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-mono text-gray-700">{batch.batchLot}</span>
                                                  {(batch.storageCartonsPerPallet || batch.shippingCartonsPerPallet) && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                                                      <Package2 className="h-3 w-3 mr-1" />
                                                      Config
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-3 text-gray-600">
                                                  <span>{batch.currentCartons} cartons</span>
                                                  {batch.storageCartonsPerPallet && (
                                                    <span className="text-gray-400">• Storage: {batch.storageCartonsPerPallet}/pallet</span>
                                                  )}
                                                  {batch.shippingCartonsPerPallet && (
                                                    <span className="text-gray-400">• Shipping: {batch.shippingCartonsPerPallet}/pallet</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              // Batch View: Show batch-specific details
                              <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-sm font-semibold text-gray-700">Batch Information</h4>
                                  {(balance.storageCartonsPerPallet || balance.shippingCartonsPerPallet) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                      <Package2 className="h-3 w-3 mr-1" />
                                      Custom Configuration
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Batch Created</p>
                                    <p className="font-semibold text-gray-900">
                                      {balance.receiveTransaction?.transactionDate
                                        ? formatDateGMT(balance.receiveTransaction.transactionDate)
                                        : 'Unknown'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Received By</p>
                                    <p className="font-semibold text-gray-900">{balance.receiveTransaction?.createdBy?.fullName || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Pallet Configuration</p>
                                    <div className="space-y-1">
                                      <p className="font-semibold text-gray-900">
                                        <span className="text-green-600">Storage:</span> {balance.storageCartonsPerPallet || 'Default'} cartons/pallet
                                      </p>
                                      <p className="font-semibold text-gray-900">
                                        <span className="text-blue-600">Shipping:</span> {balance.shippingCartonsPerPallet || 'Default'} cartons/pallet
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Value</p>
                                    <p className="font-semibold text-gray-900">
                                      {balance.currentUnits.toLocaleString()} units
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      ({balance.sku.unitsPerCarton} units/carton)
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    )
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={getBalanceUIColumns().filter(col => {
                        if (balanceView === 'sku') {
                          // In SKU view, exclude batch-specific columns
                          return !['batchLot', 'receivedBy', 'warehouse', 'storageCartonsPerPallet', 'shippingCartonsPerPallet'].includes(col.fieldName)
                        }
                        return true
                      }).length} className="px-6 py-12">
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
        </div>

        <div className={activeTab === 'transactions' ? 'flex-1 min-h-0 flex flex-col space-y-4' : 'hidden'}>
            {/* Transaction Summary Stats - Using StatsCard */}
            <StatsCardGrid cols={5} gap="gap-1">
              <StatsCard
                title="Total"
                value={filteredAndSortedTransactions.length}
                size="sm"
              />
              <StatsCard
                title="Receive"
                value={filteredAndSortedTransactions.filter(t => t.transactionType === 'RECEIVE').length}
                size="sm"
                className="[&_p:nth-child(2)]:text-green-600"
              />
              <StatsCard
                title="Ship"
                value={filteredAndSortedTransactions.filter(t => t.transactionType === 'SHIP').length}
                size="sm"
                className="[&_p:nth-child(2)]:text-red-600"
              />
              <StatsCard
                title="Adjustments"
                value={filteredAndSortedTransactions.filter(t => t.transactionType.startsWith('ADJUST')).length}
                size="sm"
                className="[&_p:nth-child(2)]:text-blue-600"
              />
              <StatsCard
                title="Unreconciled"
                value={filteredAndSortedTransactions.filter(t => !t.isReconciled).length}
                size="sm"
                className="[&_p:nth-child(2)]:text-yellow-600"
              />
            </StatsCardGrid>

            {/* Inventory Ledger Table - Fill remaining space */}
            <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Inventory Ledger Details</h3>
                    <LedgerInfoTooltip />
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{filteredAndSortedTransactions.length}</span> of{' '}
                    <span className="font-medium">{transactions.length}</span> transactions
                    <span className="text-xs text-gray-500 ml-2">
                      ({sortOrder === 'desc' ? 'Latest first' : 'Oldest first'})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {getUIColumns().map((column) => (
                        <th 
                          key={column.fieldName}
                          className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                            column.fieldName === 'cartonsInOut' || column.fieldName === 'isReconciled' 
                              ? 'text-center' 
                              : 'text-left'
                          } ${
                            column.fieldName === 'skuDescription' ? 'max-w-[200px]' :
                            column.fieldName === 'trackingNumber' ? 'max-w-[150px]' :
                            column.fieldName === 'cartonsInOut' ? 'w-32' :
                            column.fieldName === 'transactionType' ? 'w-24' :
                            column.fieldName === 'warehouse' ? 'max-w-[150px]' :
                            column.fieldName === 'batchLot' ? 'w-24' :
                            ''
                          }`}
                        >
                          {column.fieldName === 'transactionDate' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                              }}
                              className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                            >
                              {column.displayName}
                              {sortOrder === 'desc' ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ArrowUp className="h-3 w-3" />
                              )}
                            </button>
                          ) : (
                            column.displayName
                          )}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                        <div className="flex items-center justify-center gap-1">
                          Missing
                          <Tooltip 
                            content="Number of missing documents or required fields" 
                            iconSize="sm"
                            position="bottom"
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedTransactions.map((transaction) => {
                      const missingAttributes = getMissingAttributes(transaction)
                      const _isIncomplete = missingAttributes.length > 0
                      
                      return (
                      <tr 
                        key={transaction.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${!transaction.isReconciled ? 'bg-yellow-50' : ''}`}
                        onClick={() => router.push(`/operations/transactions/${transaction.id}`)}>
                        {getUIColumns().map((column) => {
                            switch (column.fieldName) {
                              case 'transactionDate':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm whitespace-nowrap">
                                    <div className="text-gray-900">
                                      {formatDateGMT(transaction.transactionDate)}
                                    </div>
                                  </td>
                                )
                              
                              case 'transactionType':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm w-24">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      getTransactionColor(transaction.transactionType)
                                    }`}>
                                      {transaction.transactionType}
                                    </span>
                                  </td>
                                )
                              
                              case 'isReconciled':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-center">
                                    {transaction.isReconciled ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        No
                                      </span>
                                    )}
                                  </td>
                                )
                              
                              case 'warehouse':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-gray-900 max-w-[150px]">
                                    <div className="truncate" title={transaction.warehouse.name}>
                                      {transaction.warehouse.name}
                                    </div>
                                  </td>
                                )
                              
                              case 'sku':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm whitespace-nowrap">
                                    <div className="font-medium text-gray-900">{transaction.sku.skuCode}</div>
                                  </td>
                                )
                              
                              case 'skuDescription':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm max-w-[200px]">
                                    <div className="text-gray-500 truncate" title={transaction.sku.description}>
                                      {transaction.sku.description}
                                    </div>
                                  </td>
                                )
                              
                              case 'batchLot':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-gray-500 w-24 text-center">
                                    {transaction.batchLot}
                                  </td>
                                )
                              
                              case 'cartonsInOut':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-center w-32">
                                    {transaction.cartonsIn > 0 ? (
                                      <span className="text-green-600 font-medium">
                                        +{transaction.cartonsIn}
                                      </span>
                                    ) : transaction.cartonsOut > 0 ? (
                                      <span className="text-red-600 font-medium">
                                        -{transaction.cartonsOut}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                )
                              
                              case 'trackingNumber':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-gray-500 max-w-[150px]">
                                    <div className="truncate" title={transaction.trackingNumber || ''}>
                                      {transaction.trackingNumber || '-'}
                                    </div>
                                  </td>
                                )
                              
                              case 'createdBy':
                                return (
                                  <td key={column.fieldName} className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                    {transaction.createdBy.fullName}
                                  </td>
                                )
                              
                              default:
                                return <td key={column.fieldName} className="px-4 py-3 text-sm text-gray-500">-</td>
                            }
                          })}
                        <td key="missing-attributes" className="px-4 py-3 text-sm text-center">
                          {missingAttributes.length > 0 ? (
                            <div className="flex items-center justify-center">
                              <Tooltip 
                                content={`Missing items:\n${missingAttributes.map(item => `• ${item}`).join('\n')}`}
                                position="left"
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 cursor-help">
                                  {missingAttributes.length}
                                </span>
                              </Tooltip>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                      )
                    })}
                    {filteredAndSortedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={getUIColumns().length + 1} className="px-6 py-12">
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
        </div>


      </div>

    </DashboardLayout>
  )
}
