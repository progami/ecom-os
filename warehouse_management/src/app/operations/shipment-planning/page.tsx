'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  Package, TrendingUp, Truck, Mail, Calendar, AlertCircle, 
  RefreshCw, ChevronRight, Clock, Building, BarChart3,
  ArrowUp, ArrowDown, Send, FileText, Check, X, Search
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { 
  SHIPMENT_PLANNING_CONFIG, 
  getStockUrgency, 
  getUrgencyReason 
} from '@/lib/config/shipment-planning'

interface FBAStockItem {
  skuId: string
  skuCode: string
  description: string
  warehouseStock: number
  fbaStock: number
  unitsPerCarton: number
  dailySalesVelocity: number
  daysOfStock: number
  suggestedShipmentCartons: number
  reorderPoint: number
  optimalShipmentCartons: number
  lastUpdated: string
}

interface ShipmentSuggestion {
  skuCode: string
  description: string
  currentFBAStock: number
  suggestedCartons: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  reason: string
}

export default function ShipmentPlanningPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stockItems, setStockItems] = useState<FBAStockItem[]>([])
  const [suggestions, setSuggestions] = useState<ShipmentSuggestion[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    fetchStockData()
  }, [session, status])

  const fetchStockData = async () => {
    try {
      setLoading(true)
      
      // Fetch FBA stock levels
      const response = await fetch('/api/amazon/inventory-comparison')
      if (response.ok) {
        const data = await response.json()
        
        // Transform data to include analytics
        const enrichedData: FBAStockItem[] = data.map((item: any) => {
          // TODO: Replace with actual sales velocity from analytics
          // For now, use a configurable default or 0 if not available
          const dailySalesVelocity = item.dailySalesVelocity || SHIPMENT_PLANNING_CONFIG.DEFAULT_DAILY_SALES_VELOCITY
          const daysOfStock = item.amazonQty > 0 && dailySalesVelocity > 0 
            ? Math.floor(item.amazonQty / dailySalesVelocity) 
            : 0
          
          // Use configuration values
          const targetDaysOfStock = SHIPMENT_PLANNING_CONFIG.TARGET_DAYS_OF_STOCK
          const reorderDays = SHIPMENT_PLANNING_CONFIG.REORDER_DAYS
          const defaultCartonsPerPallet = item.cartonsPerPallet || SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET
          
          // Calculate suggested shipment
          const reorderPoint = dailySalesVelocity * reorderDays
          const targetStock = dailySalesVelocity * targetDaysOfStock
          const suggestedUnits = Math.max(0, targetStock - item.amazonQty)
          const suggestedCartons = Math.ceil(suggestedUnits / (item.unitsPerCarton || 1))
          
          // Calculate optimal shipment size (round to pallet quantities)
          const optimalPallets = suggestedCartons > 0 
            ? Math.max(SHIPMENT_PLANNING_CONFIG.MINIMUM_PALLETS_TO_SHIP, 
                      Math.ceil(suggestedCartons / defaultCartonsPerPallet))
            : 0
          const optimalCartons = optimalPallets * defaultCartonsPerPallet

          return {
            skuId: item.skuId,
            skuCode: item.sku,
            description: item.description,
            warehouseStock: item.warehouseQty,
            fbaStock: item.amazonQty,
            unitsPerCarton: item.unitsPerCarton || 1,
            dailySalesVelocity,
            daysOfStock,
            suggestedShipmentCartons: suggestedCartons,
            reorderPoint,
            optimalShipmentCartons: optimalCartons,
            lastUpdated: item.lastUpdated || new Date().toISOString()
          }
        })
        
        setStockItems(enrichedData)
        generateSuggestions(enrichedData)
        
        // Count low stock items
        const lowStock = enrichedData.filter(item => 
          item.daysOfStock <= SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS && 
          item.warehouseStock > 0
        )
        setLowStockCount(lowStock.length)
      }
    } catch (error) {
      console.error('Error fetching stock data:', error)
      toast.error('Failed to load FBA stock data')
    } finally {
      setLoading(false)
    }
  }

  const generateSuggestions = (items: FBAStockItem[]) => {
    const newSuggestions: ShipmentSuggestion[] = []
    
    items.forEach(item => {
      const urgency = getStockUrgency(item.daysOfStock)
      const reason = getUrgencyReason(item.daysOfStock, urgency)
      
      if (urgency !== 'low' && item.warehouseStock > 0) {
        newSuggestions.push({
          skuCode: item.skuCode,
          description: item.description,
          currentFBAStock: item.fbaStock,
          suggestedCartons: item.optimalShipmentCartons,
          urgency,
          reason
        })
      }
    })
    
    // Sort by urgency
    newSuggestions.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    })
    
    setSuggestions(newSuggestions)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    
    try {
      // Sync with Amazon
      const syncResponse = await fetch('/api/amazon/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'inventory' })
      })
      
      if (syncResponse.ok) {
        toast.success('FBA stock data refreshed')
        await fetchStockData()
      }
    } catch (error) {
      toast.error('Failed to refresh FBA data')
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateShipment = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item to ship')
      return
    }
    
    // Prepare shipment data
    const shipmentItems = Array.from(selectedItems).map(skuCode => {
      const item = stockItems.find(i => i.skuCode === skuCode)
      const suggestion = suggestions.find(s => s.skuCode === skuCode)
      return {
        skuCode,
        suggestedCartons: suggestion?.suggestedCartons || item?.suggestedShipmentCartons || 0
      }
    })
    
    // Store in sessionStorage for the ship page
    sessionStorage.setItem('shipmentPlan', JSON.stringify({
      items: shipmentItems,
      source: 'fba-planning',
      createdAt: new Date().toISOString()
    }))
    
    router.push('/operations/ship')
  }

  const filteredStockItems = stockItems.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.skuCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStockFilter = !showOnlyLowStock || item.daysOfStock <= SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS
    
    return matchesSearch && matchesStockFilter
  })

  const getStockStatusColor = (daysOfStock: number) => {
    if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.CRITICAL) return 'text-red-600'
    if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.HIGH) return 'text-orange-600'
    if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.MEDIUM) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getUrgencyBadge = (urgency: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    }
    return colors[urgency as keyof typeof colors] || colors.low
  }

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
        <PageHeader
          title="FBA Shipment Planning"
          description="Monitor FBA stock levels and plan replenishments"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh FBA Data
              </button>
              <button
                onClick={handleCreateShipment}
                disabled={selectedItems.size === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                <Truck className="h-4 w-4 mr-2" />
                Create Shipment ({selectedItems.size})
              </button>
            </div>
          }
        />

        {/* Low Stock Alert */}
        {lowStockCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">
                {lowStockCount} items below {SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS} days of stock
              </span>
            </div>
          </div>
        )}

        {/* Suggestions Panel */}
        {suggestions.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-900">
                  Replenishment Suggestions
                </h3>
                <div className="mt-2 space-y-2">
                  {suggestions.slice(0, 3).map((suggestion) => (
                    <div key={suggestion.skuCode} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyBadge(suggestion.urgency)}`}>
                          {suggestion.urgency}
                        </span>
                        <span className="text-yellow-900">
                          {suggestion.skuCode}: {suggestion.reason}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedItems(new Set([...selectedItems, suggestion.skuCode]))}
                        className="text-yellow-700 hover:text-yellow-800 font-medium"
                      >
                        Add to shipment
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by SKU or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlyLowStock}
              onChange={(e) => setShowOnlyLowStock(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Show only low stock items</span>
          </label>
        </div>

        {/* Stock Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse Stock
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  FBA Stock
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Daily Velocity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days of Stock
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suggested Shipment
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStockItems.map((item) => (
                <tr key={item.skuCode} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.skuCode)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedItems)
                        if (e.target.checked) {
                          newSelected.add(item.skuCode)
                        } else {
                          newSelected.delete(item.skuCode)
                        }
                        setSelectedItems(newSelected)
                      }}
                      className="rounded border-gray-300"
                      disabled={item.warehouseStock === 0}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.skuCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {item.warehouseStock.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {item.fbaStock.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {item.dailySalesVelocity}/day
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${getStockStatusColor(item.daysOfStock)}`}>
                    {item.daysOfStock} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {item.suggestedShipmentCartons > 0 ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.optimalShipmentCartons} cartons
                        </div>
                        <div className="text-xs text-gray-500">
                          ({Math.ceil(item.optimalShipmentCartons / SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET)} pallets)
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Items</p>
                <p className="text-2xl font-bold text-red-600">
                  {suggestions.filter(s => s.urgency === 'critical').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-600">
                  {suggestions.filter(s => s.urgency === 'high').length}
                </p>
              </div>
              <ArrowUp className="h-8 w-8 text-orange-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total SKUs</p>
                <p className="text-2xl font-bold">
                  {stockItems.length}
                </p>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">
                  {stockItems[0]?.lastUpdated 
                    ? new Date(stockItems[0].lastUpdated).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}