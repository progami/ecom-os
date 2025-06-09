'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, Upload, X, ChevronDown } from 'lucide-react'
import { ExportButton } from '@/components/common/export-button'
import { toast } from 'react-hot-toast'

interface InventoryBalance {
  id: string
  warehouse: {
    id: string
    name: string
  }
  sku: {
    id: string
    skuCode: string
    description: string
  }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  lastTransactionDate: Date | null
}

interface InventoryClientProps {
  inventoryBalances: InventoryBalance[]
  totalSkus: number
  totalCartons: number
  totalPallets: number
  lowStockItems: number
  recentTransactions: any[]
}

export function InventoryClient({
  inventoryBalances,
  totalSkus,
  totalCartons,
  totalPallets,
  lowStockItems,
  recentTransactions
}: InventoryClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'zero'>('all')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('')

  // Get unique warehouses for filter
  const warehouses = useMemo(() => {
    const unique = new Set(inventoryBalances.map(b => b.warehouse.name))
    return Array.from(unique).sort()
  }, [inventoryBalances])

  // Filter inventory based on search and filters
  const filteredInventory = useMemo(() => {
    let filtered = inventoryBalances

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(balance => 
        balance.sku.skuCode.toLowerCase().includes(term) ||
        balance.sku.description.toLowerCase().includes(term) ||
        balance.batchLot.toLowerCase().includes(term)
      )
    }

    // Warehouse filter
    if (filterWarehouse) {
      filtered = filtered.filter(balance => balance.warehouse.name === filterWarehouse)
    }

    // Stock level filter
    if (filterStock === 'low') {
      filtered = filtered.filter(balance => balance.currentCartons > 0 && balance.currentCartons < 10)
    } else if (filterStock === 'zero') {
      filtered = filtered.filter(balance => balance.currentCartons === 0)
    }

    return filtered
  }, [inventoryBalances, searchTerm, filterWarehouse, filterStock])

  const handleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredInventory.map(item => item.id))
    }
  }

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  const handleBulkAction = async () => {
    if (!bulkAction) {
      toast.error('Please select a bulk action')
      return
    }

    if (selectedItems.length === 0) {
      toast.error('Please select items to perform bulk action')
      return
    }

    switch (bulkAction) {
      case 'export':
        // Create a temporary form to export selected items
        const itemIds = selectedItems.join(',')
        const url = `/api/v1/wms/export/inventory?items=${itemIds}`
        window.open(url, '_blank')
        toast.success('Exporting selected items...')
        break
      
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) {
          toast.success('Delete functionality will be implemented soon')
        }
        break
      
      case 'adjust':
        toast.success('Bulk adjustment functionality will be implemented soon')
        break
      
      default:
        toast.error('Unknown action')
    }

    // Reset selection
    setSelectedItems([])
    setBulkAction('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            View current balances and inventory ledger across all warehouses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/api/v1/wms/export/inventory"
            fileName="inventory"
            buttonText="Export All"
          />
          <Link
            href="/wms/admin/inventory/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Transaction
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by SKU, description, or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {(filterWarehouse || filterStock !== 'all') && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                {[filterWarehouse, filterStock !== 'all' && filterStock].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Warehouse</label>
                <select
                  value={filterWarehouse}
                  onChange={(e) => setFilterWarehouse(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse} value={warehouse}>{warehouse}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Stock Level</label>
                <select
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Items</option>
                  <option value="low">Low Stock ({"<"} 10 cartons)</option>
                  <option value="zero">Zero Stock</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterWarehouse('')
                    setFilterStock('all')
                    toast.success('Filters cleared')
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.length} items selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="">Select action...</option>
                <option value="export">Export Selected</option>
                <option value="adjust">Bulk Adjust</option>
                <option value="delete">Delete Selected</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total SKUs" value={totalSkus.toString()} />
        <SummaryCard title="Total Cartons" value={totalCartons.toLocaleString()} />
        <SummaryCard title="Total Pallets" value={totalPallets.toString()} />
        <SummaryCard title="Low Stock Items" value={lowStockItems.toString()} highlight={lowStockItems > 0} />
      </div>

      {/* Inventory Balance Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h3 className="text-lg font-semibold">Current Inventory Balances</h3>
          <p className="text-sm text-gray-600 mt-1">Real-time stock levels calculated from inventory ledger</p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batch/Lot
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cartons
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pallets
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Units
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInventory.map((balance) => (
              <tr key={balance.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(balance.id)}
                    onChange={() => handleSelectItem(balance.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {balance.warehouse.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{balance.sku.skuCode}</div>
                    <div className="text-xs text-gray-500">{balance.sku.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {balance.batchLot}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  <span className={balance.currentCartons < 10 ? 'text-orange-600 font-medium' : ''}>
                    {balance.currentCartons.toLocaleString()}
                  </span>
                  {balance.currentCartons === 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      OUT
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {balance.currentPallets}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {balance.currentUnits.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {balance.lastTransactionDate 
                    ? new Date(balance.lastTransactionDate).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/wms/admin/inventory/${balance.sku.skuCode}`} className="text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm || filterWarehouse || filterStock !== 'all' 
                    ? 'No items match your filters.' 
                    : 'No inventory data found. Import data to see inventory levels.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Transactions */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b">
          <h3 className="text-lg font-semibold">Recent Inventory Movements</h3>
          <p className="text-sm text-gray-600 mt-1">Inventory ledger showing all movements (RECEIVE, SHIP, ADJUST)</p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(transaction.transactionDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    transaction.transactionType === 'RECEIVE' ? 'bg-green-100 text-green-800' : 
                    transaction.transactionType === 'SHIP' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {transaction.transactionType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {transaction.warehouse.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {transaction.sku.skuCode}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {transaction.referenceId || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {transaction.cartonsIn > 0 ? `+${transaction.cartonsIn}` : `-${transaction.cartonsOut}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {transaction.createdBy.fullName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  highlight?: boolean
}

function SummaryCard({ title, value, highlight }: SummaryCardProps) {
  return (
    <div className={`border rounded-lg p-4 ${highlight ? 'border-orange-400 bg-orange-50' : ''}`}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-orange-600' : ''}`}>
        {value}
      </p>
    </div>
  )
}