'use client'

// React imports
import { useState, useEffect, useRef } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Icons
import { Plus, Package2, X, AlertCircle } from '@/lib/lucide-icons'

interface Sku {
  id: string
  skuCode: string
  description: string
  unitsPerCarton: number
}

interface InventoryItem {
  id: string
  warehouseId: string
  skuId: string
  batchLot: string
  currentCartons: number
  currentUnits: number
  storagePalletsIn: number
  shippingPalletsOut: number
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
  unitsPerCarton: number
  sku: Sku
}

interface LineItem {
  id: string
  skuCode: string
  skuId?: string
  batchLot: string
  cartons: number
  units: number
  unitsPerCarton: number
  available: number
  pallets: number
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
}

interface CargoTabProps {
  warehouseId: string
  inventory: InventoryItem[]
  inventoryLoading?: boolean
  onItemsChange: (items: LineItem[]) => void
}

export function CargoTab({ warehouseId, inventory, inventoryLoading, onItemsChange }: CargoTabProps) {
  
  // Use a ref to maintain counter across renders but reset on mount
  const itemIdCounterRef = useRef(0)
  
  const [items, setItems] = useState<LineItem[]>(() => {
    // Initialize with one empty item on first render
    const initialItem: LineItem = {
      id: `item-${++itemIdCounterRef.current}`,
      skuCode: '',
      batchLot: '',
      cartons: 0,
      units: 0,
      unitsPerCarton: 0, // Empty by default
      available: 0,
      pallets: 0,
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0
    }
    return [initialItem]
  })

  // Notify parent when items change
  useEffect(() => {
    onItemsChange(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Get available inventory for the selected warehouse
  const availableInventory = inventory.filter(item => 
    item.warehouseId === warehouseId && item.currentCartons > 0
  )

  // Group inventory by SKU to get unique SKU/batch combinations
  const getSkuBatchOptions = () => {
    const options = availableInventory.map(item => ({
      value: `${item.skuId}_${item.batchLot}`,
      label: `${item.sku.skuCode} - ${item.batchLot} (${item.currentCartons} cartons)`,
      inventory: item
    }))
    return options
  }

  const addItem = () => {
    const newItem: LineItem = {
      id: `item-${++itemIdCounterRef.current}`,
      skuCode: '',
      skuId: undefined,
      batchLot: '',
      cartons: 0,
      units: 0,
      unitsPerCarton: 0, // Empty by default
      available: 0,
      pallets: 0,
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0
    }
    setItems(prev => [...prev, newItem])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error('Please add at least one item')
      return
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number | null) => {
    setItems(prevItems => prevItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))

    // If SKU/batch selection changed, update all related fields
    if (field === 'skuCode' && value) {
      const [skuId, batchLot] = String(value).split('_')
      const inventoryItem = availableInventory.find(
        inv => inv.skuId === skuId && inv.batchLot === batchLot
      )
      
      if (inventoryItem) {
        setItems(prevItems => prevItems.map(item => {
          if (item.id === id) {
            return {
              ...item,
              skuCode: inventoryItem.sku.skuCode,
              skuId: inventoryItem.skuId,
              batchLot: inventoryItem.batchLot,
              available: inventoryItem.currentCartons,
              unitsPerCarton: inventoryItem.unitsPerCarton,
              storageCartonsPerPallet: inventoryItem.storageCartonsPerPallet,
              shippingCartonsPerPallet: inventoryItem.shippingCartonsPerPallet || 0,
              units: item.cartons * inventoryItem.unitsPerCarton
            }
          }
          return item
        }))
      }
    }

    // If cartons changed, recalculate units and pallets
    if (field === 'cartons') {
      setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
          const cartons = Number(value) || 0
          const units = cartons * item.unitsPerCarton
          
          // Auto-calculate pallets if config is loaded
          let pallets = item.pallets
          if (item.shippingCartonsPerPallet > 0 && cartons > 0) {
            pallets = Math.ceil(cartons / item.shippingCartonsPerPallet)
          }
          
          return { ...item, cartons, units, pallets }
        }
        return item
      }))
    }

    // If shipping config changes, recalculate pallets
    if (field === 'shippingCartonsPerPallet') {
      setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
          const configValue = Number(value) || 0
          let pallets = item.pallets
          
          if (configValue > 0 && item.cartons > 0) {
            pallets = Math.ceil(item.cartons / configValue)
          }
          
          return { ...item, shippingCartonsPerPallet: configValue, pallets }
        }
        return item
      }))
    }
  }

  // Calculate totals
  const totals = {
    cartons: items.reduce((sum, item) => sum + item.cartons, 0),
    pallets: items.reduce((sum, item) => sum + item.pallets, 0),
    units: items.reduce((sum, item) => sum + item.units, 0)
  }

  return (
    <div className="space-y-6">
      {/* Cargo Details Section */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Cargo Details
          </h3>
          {warehouseId && (
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          )}
        </div>
        
        
        <div className="p-6">
      
      {!warehouseId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              Please select a warehouse in the Details tab first to view available inventory.
            </p>
          </div>
        </div>
      ) : inventoryLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      ) : availableInventory.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              No items available. Please check your selection.
            </p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No items added yet</p>
          <button
            type="button"
            onClick={addItem}
            className="mt-4 text-primary hover:underline"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU / Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cartons</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units/Carton</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage Config</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipping Config</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pallets</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Units</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => {
                  const hasError = item.cartons > item.available
                  
                  return (
                    <tr key={item.id} className={hasError ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">
                        <select
                          name={`sku-batch-${item.id}`}
                          value={item.skuId && item.batchLot ? `${item.skuId}_${item.batchLot}` : ''}
                          onChange={(e) => updateItem(item.id, 'skuCode', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary"
                          required
                        >
                          <option value="">Select SKU/Batch...</option>
                          {getSkuBatchOptions().map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.available}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-right"
                          readOnly
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <input
                            name={`cartons-${item.id}`}
                            type="number"
                            min="1"
                            max={item.available}
                            value={item.cartons || ''}
                            onChange={(e) => updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)}
                            className={`w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right ${
                              hasError ? 'border-red-500' : ''
                            }`}
                            required
                          />
                          {hasError && (
                            <p className="text-xs text-red-600 mt-1">
                              Exceeds available ({item.available})
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.unitsPerCarton}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-right"
                          readOnly
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.storageCartonsPerPallet || ''}
                            onChange={(e) => updateItem(item.id, 'storageCartonsPerPallet', parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right ${
                              item.storageCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                            }`}
                            placeholder="0"
                            title={item.storageCartonsPerPallet > 0 ? 
                              'Loaded from original receive (editable)' : 'Enter value'}
                          />
                          <span className="text-xs text-gray-500">c/p</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.shippingCartonsPerPallet || ''}
                            onChange={(e) => updateItem(item.id, 'shippingCartonsPerPallet', parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right ${
                              item.shippingCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                            }`}
                            placeholder="0"
                            title={item.shippingCartonsPerPallet > 0 ? 
                              'Loaded from original receive (editable)' : 'Enter value'}
                          />
                          <span className="text-xs text-gray-500">c/p</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.pallets || ''}
                          onChange={(e) => updateItem(item.id, 'pallets', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right"
                          placeholder={
                            item.cartons > 0 && item.shippingCartonsPerPallet > 0 
                              ? `${Math.ceil(item.cartons / item.shippingCartonsPerPallet)}` 
                              : ''
                          }
                          title="Shipping pallets (auto-calculated, but can be overridden)"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.units}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-right"
                          readOnly
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={items.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-right font-semibold" colSpan={2}>
                    Totals:
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {totals.cartons.toLocaleString()}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {totals.pallets}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {totals.units.toLocaleString()}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  )
}

CargoTab.displayName = 'ShipCargoTab'
