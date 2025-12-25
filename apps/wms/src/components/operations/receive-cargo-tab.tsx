'use client'

// React imports
import { useState, useEffect, useRef } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Icons
import { Package2, Loader2, AlertCircle, Plus, Trash2 } from '@/lib/lucide-icons'

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

interface BatchOption {
  id: string
  batchCode: string
  description: string | null
  productionDate: string | null
  expiryDate: string | null
  unitsPerCarton: number | null
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  isActive: boolean
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

  const createEmptyItem = (id?: string): LineItem => ({
    id: id ?? `item-${++itemIdCounterRef.current}`,
    skuCode: '',
    batchLot: '',
    cartons: 0,
    units: 0,
    unitsPerCarton: 0,
    storagePalletsIn: 0,
    storageCartonsPerPallet: 0,
    shippingCartonsPerPallet: 0,
    configLoaded: false,
    loadingBatch: false,
  })

  const [items, setItems] = useState<LineItem[]>(() => [createEmptyItem()])
  const [batchesBySku, setBatchesBySku] = useState<Record<string, BatchOption[]>>({})

  const addNewItem = () => {
    setItems(prev => [...prev, createEmptyItem()])
  }

  const removeItem = (id: string) => {
    setItems(prev => {
      if (prev.length === 1) {
        return prev.map(item => (item.id === id ? createEmptyItem(item.id) : item))
      }
      return prev.filter(item => item.id !== id)
    })
  }

  // Notify parent when items change
  useEffect(() => {
    onItemsChange(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const fetchBatchesForSku = async (sku: Sku): Promise<BatchOption[]> => {
    if (!sku?.id) return []

    if (batchesBySku[sku.id]) {
      return batchesBySku[sku.id]
    }

    try {
      const response = await fetch(`/api/skus/${sku.id}/batches`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load batches')
      }

      const data = await response.json()
      const options: BatchOption[] = Array.isArray(data.batches) ? data.batches : []
      setBatchesBySku(prev => ({ ...prev, [sku.id]: options }))
      return options
    } catch (_error) {
      toast.error(`Failed to load batches for ${sku.skuCode}`)
      setBatchesBySku(prev => ({ ...prev, [sku.id]: [] }))
      return []
    }
  }

  const loadBatchesForItem = async (itemId: string, sku: Sku) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              skuId: sku.id,
              skuCode: sku.skuCode,
              unitsPerCarton: 0,
              units: 0,
              batchLot: '',
              storageCartonsPerPallet: 0,
              shippingCartonsPerPallet: 0,
              configLoaded: false,
              loadingBatch: true,
            }
          : item
      )
    )

    const batches = await fetchBatchesForSku(sku)

    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) {
          return item
        }

        const defaultBatch = batches.length === 1 ? batches[0] : null
        const cartons = item.cartons || 0
        const unitsPerCarton = defaultBatch?.unitsPerCarton ?? 0
        const storageCartonsPerPallet = defaultBatch?.storageCartonsPerPallet ?? 0
        const shippingCartonsPerPallet = defaultBatch?.shippingCartonsPerPallet ?? 0

        const next = {
          ...item,
          skuId: sku.id,
          batchLot: defaultBatch?.batchCode ?? '',
          unitsPerCarton,
          units: cartons * unitsPerCarton,
          storageCartonsPerPallet,
          shippingCartonsPerPallet,
          configLoaded: defaultBatch !== null,
          loadingBatch: false,
        }

        if (storageCartonsPerPallet > 0 && cartons > 0) {
          next.storagePalletsIn = Math.ceil(cartons / storageCartonsPerPallet)
        }

        return next
      })
    )

    if (batches.length === 0) {
      toast.error(
        `No batches configured for ${sku.skuCode}. Create one in Config → Products → Batches.`
      )
    }
  }

  const updateItem = async (id: string, field: keyof LineItem, value: string | number | null) => {
    setItems(prevItems =>
      prevItems.map(item => (item.id === id ? { ...item, [field]: value } : item))
    )

    // If SKU code changed, load batches and defaults
    if (field === 'skuCode') {
      if (value) {
        const selectedSku = skus.find(sku => sku.skuCode === value)
        if (selectedSku) {
          await loadBatchesForItem(id, selectedSku)
        }
      } else {
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === id ? { ...item, skuId: undefined, batchLot: '', loadingBatch: false } : item
          )
        )
      }
      return
    }

    // If batch changed, apply batch-level defaults for cartons per pallet
    if (field === 'batchLot') {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id !== id) return item
          if (!item.skuId) return item

          const options = batchesBySku[item.skuId] ?? []
          const selectedCode = String(value ?? '')
          const selected = options.find(batch => batch.batchCode === selectedCode)

          const unitsPerCarton = selected?.unitsPerCarton ?? item.unitsPerCarton
          const storageCartonsPerPallet = selected?.storageCartonsPerPallet ?? 0
          const shippingCartonsPerPallet = selected?.shippingCartonsPerPallet ?? 0

          const next = {
            ...item,
            batchLot: selectedCode,
            unitsPerCarton,
            units: item.cartons * unitsPerCarton,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            configLoaded: true,
          }

          if (storageCartonsPerPallet > 0 && next.cartons > 0) {
            next.storagePalletsIn = Math.ceil(next.cartons / storageCartonsPerPallet)
          }

          return next
        })
      )
      return
    }

    // If cartons changed, recalculate units and pallets
    if (field === 'cartons') {
      setItems(prevItems =>
        prevItems.map(item => {
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
        })
      )
    }

    // If units per carton changed, recalculate total units
    if (field === 'unitsPerCarton') {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id === id) {
            const unitsPerCarton = Number(value) || 0 // Don't default to 1
            const units = item.cartons * unitsPerCarton
            return { ...item, unitsPerCarton, units }
          }
          return item
        })
      )
    }

    // If storage config changes, recalculate pallets
    if (field === 'storageCartonsPerPallet') {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id === id) {
            const configValue = Number(value) || 0
            let storagePalletsIn = item.storagePalletsIn

            if (configValue > 0 && item.cartons > 0) {
              storagePalletsIn = Math.ceil(item.cartons / configValue)
            }

            return { ...item, storageCartonsPerPallet: configValue, storagePalletsIn }
          }
          return item
        })
      )
    }
  }

  // Calculate totals
  const totals = {
    cartons: items.reduce((sum, item) => sum + item.cartons, 0),
    pallets: items.reduce((sum, item) => sum + item.storagePalletsIn, 0),
    units: items.reduce((sum, item) => sum + item.units, 0),
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Cargo Details
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Add SKUs and batch information for receiving
          </p>
        </div>

        <div className="p-6">
          {!warehouseId ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Please select a warehouse in the Details tab first to add inventory items.
                </p>
              </div>
            </div>
          ) : skusLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-sm text-slate-600">Loading data...</span>
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="min-w-[1100px] w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Batch/Lot
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Cartons
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Units/Carton
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Storage Config
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Shipping Config
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Pallets
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Total Units
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            name={`sku-${item.id}`}
                            value={item.skuCode}
                            onChange={e => updateItem(item.id, 'skuCode', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                            required
                            disabled={skus.length === 0}
                          >
                            <option value="">
                              {skus.length === 0 ? 'No SKUs available' : 'Select SKU...'}
                            </option>
                            {(skus || []).map(sku => (
                              <option key={sku.id} value={sku.skuCode}>
                                {sku.skuCode}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const options = item.skuId ? (batchesBySku[item.skuId] ?? []) : []

                            if (item.loadingBatch) {
                              return (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Loading batches…</span>
                                </div>
                              )
                            }

                            if (!item.skuId) {
                              return (
                                <span className="text-sm text-slate-500">Select a SKU first</span>
                              )
                            }

                            if (options.length === 0) {
                              return (
                                <span className="text-sm text-amber-600">No batches defined</span>
                              )
                            }

                            return (
                              <select
                                name={`batch-${item.id}`}
                                value={item.batchLot}
                                onChange={e => updateItem(item.id, 'batchLot', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                required
                              >
                                <option value="">Select batch…</option>
                                {options.map(batch => (
                                  <option key={batch.id} value={batch.batchCode}>
                                    {batch.batchCode}
                                  </option>
                                ))}
                              </select>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            name={`cartons-${item.id}`}
                            type="number"
                            min="1"
                            value={item.cartons || ''}
                            onChange={e =>
                              updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            required
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            name={`units-per-carton-${item.id}`}
                            type="number"
                            min="1"
                            value={item.unitsPerCarton || ''}
                            onChange={e =>
                              updateItem(item.id, 'unitsPerCarton', parseInt(e.target.value) || 1)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            placeholder="1"
                            required
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={item.storageCartonsPerPallet || ''}
                              onChange={e =>
                                updateItem(
                                  item.id,
                                  'storageCartonsPerPallet',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className={`w-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right ${
                                item.configLoaded && item.storageCartonsPerPallet > 0
                                  ? 'bg-yellow-50'
                                  : ''
                              }`}
                              placeholder={!item.skuCode ? '' : item.configLoaded ? '0' : '...'}
                              title={
                                !item.skuCode
                                  ? 'Select SKU first'
                                  : !item.configLoaded
                                    ? 'Select batch to load defaults'
                                    : item.storageCartonsPerPallet > 0
                                      ? 'Default applied from batch (editable)'
                                      : 'No default set for batch (enter value)'
                              }
                              required
                            />
                            <span className="text-xs text-slate-500">c/p</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={item.shippingCartonsPerPallet || ''}
                              onChange={e =>
                                updateItem(
                                  item.id,
                                  'shippingCartonsPerPallet',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className={`w-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right ${
                                item.configLoaded && item.shippingCartonsPerPallet > 0
                                  ? 'bg-yellow-50'
                                  : ''
                              }`}
                              placeholder={!item.skuCode ? '' : item.configLoaded ? '0' : '...'}
                              title={
                                !item.skuCode
                                  ? 'Select SKU first'
                                  : !item.configLoaded
                                    ? 'Select batch to load defaults'
                                    : item.shippingCartonsPerPallet > 0
                                      ? 'Default applied from batch (editable)'
                                      : 'No default set for batch (enter value)'
                              }
                              required
                            />
                            <span className="text-xs text-slate-500">c/p</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={item.storagePalletsIn || ''}
                            onChange={e =>
                              updateItem(item.id, 'storagePalletsIn', parseInt(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            placeholder={
                              item.cartons > 0 && item.storageCartonsPerPallet > 0
                                ? `${Math.ceil(item.cartons / item.storageCartonsPerPallet)}`
                                : ''
                            }
                            title="Storage pallets (auto-calculated, but can be overridden)"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="number"
                            value={item.units}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-100 text-right"
                            readOnly
                            title="Units are calculated based on cartons × units per carton"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            title="Remove line item"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td
                        className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                        colSpan={2}
                      >
                        Totals:
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {totals.cartons.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {totals.pallets}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {totals.units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                    </tr>
                  </tfoot>
                </table>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addNewItem}
                    className="inline-flex items-center gap-2 rounded-md border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" />
                    Add another SKU
                  </button>
                  <p className="text-xs text-slate-500">
                    Capture multiple SKUs or batches in a single receiving transaction.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

CargoTab.displayName = 'ReceiveCargoTab'
