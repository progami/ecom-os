'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Package2, RefreshCw, Loader2, Search, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface InventoryComparison {
  sku: string
  description: string
  warehouseQty: number
  amazonQty: number
  total: number
  lastUpdated?: string
  trend?: 'up' | 'down' | 'stable'
  percentChange?: number
}

export default function AmazonIntegrationPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [inventory, setInventory] = useState<InventoryComparison[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selectedView, setSelectedView] = useState<'all' | 'warehouse' | 'amazon' | 'lowstock'>('all')
  const [sortBy, setSortBy] = useState<'sku' | 'total' | 'trend'>('sku')

  useEffect(() => {
    const fetchAndSyncInventory = async () => {
      setLoading(true)
      try {
        // Skip warehouse setup - it should be done manually
        
        // Fetch inventory comparison
        const response = await fetch('/api/amazon/inventory-comparison')
        if (response.ok) {
          const data = await response.json()
          setInventory(data)
          setLastRefresh(new Date())
          
          // Sync from Amazon API to database
          const syncResponse = await fetch('/api/amazon/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ syncType: 'inventory' })
          })
          
          if (syncResponse.ok) {
            const result = await syncResponse.json()
            if (result.synced > 0) {
              toast.success(`Synced ${result.synced} items from Amazon FBA`)
              
              // Refresh the inventory comparison after sync
              const refreshResponse = await fetch('/api/amazon/inventory-comparison')
              if (refreshResponse.ok) {
                const refreshedData = await refreshResponse.json()
                setInventory(refreshedData)
              }
            }
          } else {
            const errorData = await syncResponse.json()
            console.error('Sync error:', errorData)
            toast.error('Failed to sync Amazon inventory')
          }
        } else {
          const errorData = await response.json()
          console.error('API Error:', errorData)
          toast.error(errorData.details || 'Failed to fetch inventory comparison')
        }
      } catch (error) {
        console.error('Error in fetchAndSyncInventory:', error)
        if (error instanceof Error) {
          toast.error(`Error: ${error.message}`)
        } else {
          toast.error('Error fetching inventory data')
        }
      } finally {
        setLoading(false)
      }
    }

    // Only fetch if authenticated
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      fetchAndSyncInventory()
    }
  }, [status, session])

  const filteredInventory = inventory
    .filter(item => {
      const matchesSearch = item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      switch (selectedView) {
        case 'warehouse':
          return matchesSearch && item.warehouseQty > 0
        case 'amazon':
          return matchesSearch && item.amazonQty > 0
        case 'lowstock':
          return matchesSearch && item.total < 50
        default:
          return matchesSearch
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return b.total - a.total
        case 'trend':
          return (b.percentChange || 0) - (a.percentChange || 0)
        default:
          return a.sku.localeCompare(b.sku)
      }
    })

  const totalWarehouse = inventory.reduce((sum, item) => sum + item.warehouseQty, 0)
  const totalAmazon = inventory.reduce((sum, item) => sum + item.amazonQty, 0)
  const totalCombined = totalWarehouse + totalAmazon
  const skusWithStock = inventory.filter(item => item.total > 0).length
  const totalSkus = inventory.length
  const lowStockSkus = inventory.filter(item => item.total > 0 && item.total < 50).length
  const outOfStockSkus = inventory.filter(item => item.total === 0).length

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'admin') {
    router.push('/auth/login')
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Amazon Integration"
          subtitle="Inventory overview by location"
          description="Overview of inventory levels across all warehouse locations. Shows all SKUs including those with zero stock."
          icon={Package2}
          iconColor="text-orange-600"
          bgColor="bg-orange-50"
          borderColor="border-orange-200"
          textColor="text-orange-800"
        />

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={async () => {
              setLoading(true)
              try {
                // Skip warehouse setup - it should be done manually
                
                // Fetch inventory comparison
                const response = await fetch('/api/amazon/inventory-comparison')
                if (response.ok) {
                  const data = await response.json()
                  setInventory(data)
                  setLastRefresh(new Date())
                  
                  // Sync from Amazon API to database
                  const syncResponse = await fetch('/api/amazon/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ syncType: 'inventory' })
                  })
                  
                  if (syncResponse.ok) {
                    const result = await syncResponse.json()
                    if (result.synced > 0) {
                      toast.success(`Synced ${result.synced} items from Amazon FBA`)
                      
                      // Refresh the inventory comparison after sync
                      const refreshResponse = await fetch('/api/amazon/inventory-comparison')
                      if (refreshResponse.ok) {
                        const refreshedData = await refreshResponse.json()
                        setInventory(refreshedData)
                      }
                    }
                  } else {
                    const errorData = await syncResponse.json()
                    console.error('Sync error:', errorData)
                    toast.error('Failed to sync Amazon inventory')
                  }
                } else {
                  const errorData = await response.json()
                  console.error('API Error:', errorData)
                  toast.error(errorData.details || 'Failed to fetch inventory comparison')
                }
              } catch (error) {
                console.error('Error in refresh:', error)
                if (error instanceof Error) {
                  toast.error(`Error: ${error.message}`)
                } else {
                  toast.error('Error refreshing data')
                }
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Data
              </>
            )}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Warehouse Stock</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalWarehouse.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">units</p>
              </div>
              <Package2 className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Amazon FBA</h3>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {totalAmazon.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">units</p>
              </div>
              <Package2 className="h-8 w-8 text-orange-400" />
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Combined Total</h3>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {totalCombined.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">units across all locations</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600">Stock Alerts</h3>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {lowStockSkus}
                </p>
                <p className="text-xs text-gray-500 mt-1">SKUs low/out of stock</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* View Filters */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedView('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              All SKUs ({totalSkus})
            </button>
            <button
              onClick={() => setSelectedView('warehouse')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'warehouse'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Warehouse Only
            </button>
            <button
              onClick={() => setSelectedView('amazon')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'amazon'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Amazon FBA Only
            </button>
            <button
              onClick={() => setSelectedView('lowstock')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'lowstock'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Low Stock ({lowStockSkus})
            </button>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="sku">SKU</option>
                <option value="total">Total Stock</option>
                <option value="trend">Trend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warehouse Units
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amazon FBA
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total (Units)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No inventory data found
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const hasNoStock = item.total === 0
                    const isLowStock = item.total > 0 && item.total < 50
                    return (
                      <tr key={item.sku} className={`hover:bg-gray-50 ${hasNoStock ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {item.sku}
                            {isLowStock && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Low Stock
                              </span>
                            )}
                            {hasNoStock && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.description}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                          item.warehouseQty === 0 ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {item.warehouseQty.toLocaleString()}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                          item.amazonQty === 0 ? 'text-gray-400' : 'text-orange-600'
                        }`}>
                          {item.amazonQty.toLocaleString()}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                          item.total === 0 ? 'text-gray-400' : isLowStock ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          <div className="flex items-center justify-end gap-2">
                            {item.total.toLocaleString()}
                            {item.trend && (
                              <TrendingUp 
                                className={`h-4 w-4 ${
                                  item.trend === 'up' ? 'text-green-500' : 
                                  item.trend === 'down' ? 'text-red-500' : 
                                  'text-gray-400'
                                }`}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Inventory Distribution</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">SKUs with stock:</span>
                <span className="font-medium">{skusWithStock} / {totalSkus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Warehouse coverage:</span>
                <span className="font-medium">{((totalWarehouse / totalCombined) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amazon FBA coverage:</span>
                <span className="font-medium">{((totalAmazon / totalCombined) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Stock Health</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Low stock SKUs:</span>
                <span className="font-medium text-orange-600">{lowStockSkus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Out of stock SKUs:</span>
                <span className="font-medium text-red-600">{outOfStockSkus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Healthy stock SKUs:</span>
                <span className="font-medium text-green-600">{skusWithStock - lowStockSkus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This page displays inventory levels across all warehouse locations. Showing {skusWithStock} of {totalSkus} SKUs with stock.
            The total column shows the combined inventory across all locations.
          </p>
        </div>

        {/* Amazon API Status */}
        {lastRefresh && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>Amazon FBA Connected:</strong> Production API active. Last synced: {lastRefresh.toLocaleString()}
              <br />Click "Refresh Data" to sync the latest inventory from Amazon FBA.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}