'use client'

// React imports
import { useState, useEffect, useRef } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Icons
import { Plus, Package2, X, Loader2, AlertCircle } from '@/lib/lucide-icons'

interface Sku {
  id: string
  skuCode: string
  description: string
  unitsPerCarton: number
}

interface LineItem {
  id: string
  skuCode: string
  skuId?: string
  batchLot: string
  cartons: number
  units: number
  unitsPerCarton: number
  storagePalletsIn: number
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
  configLoaded: boolean
  loadingBatch: boolean
}

interface CargoTabProps {
  warehouseId: string
  skus: Sku[]
  skusLoading?: boolean
  onItemsChange: (items: LineItem[]) => void
}

export function CargoTab({ warehouseId, skus = [], skusLoading, onItemsChange }: CargoTabProps) {
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
      storagePalletsIn: 0,
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0,
      configLoaded: false,
      loadingBatch: false
    }
    return [initialItem]
  })

  // Notify parent when items change
  useEffect(() => {
    onItemsChange(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const addItem = () => {
    const newItem: LineItem = {
      id: `item-${++itemIdCounterRef.current}`,
      skuCode: '',
      batchLot: '',
      cartons: 0,
      units: 0,
      unitsPerCarton: 0, // Empty by default
      storagePalletsIn: 0,
      storageCartonsPerPallet: 0,
      shippingCartonsPerPallet: 0,
      configLoaded: false,
      loadingBatch: false
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

  const updateItem = async (id: string, field: keyof LineItem, value: string | number | null) => {
    setItems(prevItems => prevItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))

    // If SKU code changed, fetch defaults and next batch number
    if (field === 'skuCode' && value) {
      const selectedSku = skus.find(sku => sku.skuCode === value)
      if (selectedSku) {
        // Update SKU ID and units per carton from SKU master data
        setItems(prevItems => prevItems.map(item => {
          if (item.id === id) {
            return { 
              ...item, 
              skuId: selectedSku.id,
              unitsPerCarton: selectedSku.unitsPerCarton || 0,
              units: (item.cartons || 0) * (selectedSku.unitsPerCarton || 0)
            }
          }
          return item
        }))
      }
      await fetchSkuDefaults(id, value)
      await fetchNextBatchNumber(id, value)
    }

    // If cartons changed, recalculate units and pallets
    if (field === 'cartons') {
      setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
          const cartons = Number(value) || 0
          const units = cartons * (item.unitsPerCarton || 0) // Handle empty unitsPerCarton
          
          // Auto-calculate pallets if config is loaded
          let storagePalletsIn = item.storagePalletsIn
          if (item.storageCartonsPerPallet > 0 && cartons > 0) {
            storagePalletsIn = Math.ceil(cartons / item.storageCartonsPerPallet)
          }
          
          return { ...item, cartons, units, storagePalletsIn }
        }
        return item
      }))
    }

    // If units per carton changed, recalculate total units
    if (field === 'unitsPerCarton') {
      setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
          const unitsPerCarton = Number(value) || 0 // Don't default to 1
          const units = item.cartons * unitsPerCarton
          return { ...item, unitsPerCarton, units }
        }
        return item
      }))
    }

    // If storage config changes, recalculate pallets
    if (field === 'storageCartonsPerPallet') {
      setItems(prevItems => prevItems.map(item => {
        if (item.id === id) {
          const configValue = Number(value) || 0
          let storagePalletsIn = item.storagePalletsIn
          
          if (configValue > 0 && item.cartons > 0) {
            storagePalletsIn = Math.ceil(item.cartons / configValue)
          }
          
          return { ...item, storageCartonsPerPallet: configValue, storagePalletsIn }
        }
        return item
      }))
    }
  }

  const fetchSkuDefaults = async (itemId: string, skuCode: string) => {
    try {
      if (!warehouseId || !skuCode) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, configLoaded: true } : item
        ))
        return
      }

      const sku = skus.find(s => s.skuCode === skuCode)
      if (!sku) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, configLoaded: true } : item
        ))
        return
      }

      // Fetch warehouse-specific config
      const configResponse = await fetch(`/api/warehouse-configs?warehouseId=${warehouseId}&skuId=${sku.id}`, {
        credentials: 'include'
      })
      let storageCartonsPerPallet = 0
      let shippingCartonsPerPallet = 0

      if (configResponse.ok) {
        const configs = await configResponse.json()
        if (configs.length > 0) {
          storageCartonsPerPallet = configs[0].storageCartonsPerPallet || 0
          shippingCartonsPerPallet = configs[0].shippingCartonsPerPallet || 0
        }
      }
      
      // Skip warehouse defaults lookup - endpoint not implemented
      // If no SKU-specific config found, values remain at 0

      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const updatedItem = {
            ...item,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            configLoaded: true,
          }
          
          // Auto-calculate pallets if cartons are already entered
          if (storageCartonsPerPallet > 0 && item.cartons > 0) {
            updatedItem.storagePalletsIn = Math.ceil(item.cartons / storageCartonsPerPallet)
          }
          
          return updatedItem
        }
        return item
      }))
    } catch (_error) {
      // console.error('Failed to fetch SKU defaults:', _error)
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, configLoaded: true } : item
      ))
    }
  }

  const fetchNextBatchNumber = async (itemId: string, skuCode: string) => {
    try {
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, loadingBatch: true } : item
      ))
      
      // Get the SKU ID from the selected SKU
      const selectedSku = skus.find(s => s.skuCode === skuCode)
      if (!selectedSku) {
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { ...item, batchLot: '1', loadingBatch: false } : item
        ))
        return
      }
      
      // Query the next batch number API
      const response = await fetch(`/api/inventory/next-batch?skuId=${selectedSku.id}&warehouseId=${warehouseId}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { ...item, batchLot: data.nextBatch, loadingBatch: false } : item
        ))
      } else {
        // If the API fails, default to 1
        setItems(prevItems => prevItems.map(item => 
          item.id === itemId ? { ...item, batchLot: '1', loadingBatch: false } : item
        ))
      }
    } catch (_error) {
      // console.error('Failed to fetch next batch number:', _error)
      // On error, default to 1
      setItems(prevItems => prevItems.map(item => 
        item.id === itemId ? { ...item, batchLot: '1', loadingBatch: false } : item
      ))
    }
  }

  // Calculate totals
  const totals = {
    cartons: items.reduce((sum, item) => sum + item.cartons, 0),
    pallets: items.reduce((sum, item) => sum + item.storagePalletsIn, 0),
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
              Please select a warehouse in the Details tab first to add inventory items.
            </p>
          </div>
        </div>
      ) : skusLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      ) : skus.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Batch</th>
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
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <select
                        name={`sku-${item.id}`}
                        value={item.skuCode}
                        onChange={(e) => updateItem(item.id, 'skuCode', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="">Select SKU...</option>
                        {(skus || []).map((sku) => (
                          <option key={sku.id} value={sku.skuCode}>
                            {sku.skuCode}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <input
                          name={`batch-${item.id}`}
                          type="text"
                          value={item.batchLot}
                          onChange={(e) => {
                            // Only allow integers
                            const value = e.target.value
                            if (value === '' || /^\d+$/.test(value)) {
                              updateItem(item.id, 'batchLot', value)
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary"
                          placeholder={item.loadingBatch ? "Loading..." : "Enter batch..."}
                          required
                        />
                        {item.loadingBatch && (
                          <Loader2 className="absolute right-2 top-1.5 h-4 w-4 animate-spin text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        name={`cartons-${item.id}`}
                        type="number"
                        min="1"
                        value={item.cartons || ''}
                        onChange={(e) => updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        name={`units-per-carton-${item.id}`}
                        type="number"
                        min="1"
                        value={item.unitsPerCarton || ''}
                        onChange={(e) => updateItem(item.id, 'unitsPerCarton', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right"
                        placeholder="1"
                        required
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
                            item.configLoaded && item.storageCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                          }`}
                          placeholder={!item.skuCode ? "" : item.configLoaded ? "0" : "..."}
                          title={!item.skuCode ? 'Select SKU first' : 
                            item.configLoaded && item.storageCartonsPerPallet > 0 ? 
                            'Loaded from warehouse config (editable)' : 'Enter value'}
                          required
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
                            item.configLoaded && item.shippingCartonsPerPallet > 0 ? 'bg-yellow-50' : ''
                          }`}
                          placeholder={!item.skuCode ? "" : item.configLoaded ? "0" : "..."}
                          title={!item.skuCode ? 'Select SKU first' : 
                            item.configLoaded && item.shippingCartonsPerPallet > 0 ? 
                            'Loaded from warehouse config (editable)' : 'Enter value'}
                          required
                        />
                        <span className="text-xs text-gray-500">c/p</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={item.storagePalletsIn || ''}
                        onChange={(e) => updateItem(item.id, 'storagePalletsIn', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary text-right"
                        placeholder={
                          item.cartons > 0 && item.storageCartonsPerPallet > 0 
                            ? `${Math.ceil(item.cartons / item.storageCartonsPerPallet)}` 
                            : ''
                        }
                        title="Storage pallets (auto-calculated, but can be overridden)"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.units}
                        className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-right"
                        readOnly
                        title="Units are calculated based on cartons × units per carton"
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
                ))}
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

CargoTab.displayName = 'ReceiveCargoTab'