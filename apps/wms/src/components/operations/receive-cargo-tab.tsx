'use client'

// React imports
import { useState, useEffect, useRef } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Components
import { CreateSkuBatchModal } from './create-sku-batch-modal'

// Icons
import { Package2, Loader2, AlertCircle, Plus, Trash2 } from '@/lib/lucide-icons'

interface Sku {
  id: string
  skuCode: string
  description: string
  unitsPerCarton: number
}

interface SkuBatchData {
  // SKU Master Data
  skuCode: string
  description: string
  asin?: string
  packSize: number
  material?: string
  unitDimensionsCm?: string
  unitWeightKg?: number
  unitsPerCarton: number
  cartonDimensionsCm?: string
  cartonWeightKg?: number
  packagingType?: string

  // Batch Data
  batchCode: string
  batchDescription?: string
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

  // New fields for SKU+Batch creation
  isNewSku?: boolean
  skuData?: SkuBatchData
}

interface BatchOption {
  id: string
  batchCode: string
  description: string | null
  productionDate: string | null
  expiryDate: string | null
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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentEditingItemId, setCurrentEditingItemId] = useState<string | null>(null)

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
              unitsPerCarton: sku.unitsPerCarton || 0,
              units: (item.cartons || 0) * (sku.unitsPerCarton || 0),
              batchLot: '',
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

        const defaultBatch = batches.length === 1 ? batches[0].batchCode : ''
        const cartons = item.cartons || 0
        const unitsPerCarton = sku.unitsPerCarton || item.unitsPerCarton || 0

        return {
          ...item,
          skuId: sku.id,
          batchLot: defaultBatch,
          unitsPerCarton,
          units: cartons * unitsPerCarton,
          loadingBatch: false,
        }
      })
    )

    if (batches.length === 0) {
      toast.error(`No batches configured for ${sku.skuCode}. Create one under Products → Batches.`)
    }
  }

  const handleCreateNewSkuBatch = (itemId: string) => {
    setCurrentEditingItemId(itemId)
    setIsModalOpen(true)
  }

  const handleSkuBatchSave = (data: SkuBatchData) => {
    if (!currentEditingItemId) return

    setItems(prev =>
      prev.map(item => {
        if (item.id !== currentEditingItemId) return item

        return {
          ...item,
          skuCode: data.skuCode,
          batchLot: data.batchCode,
          unitsPerCarton: data.unitsPerCarton,
          units: item.cartons * data.unitsPerCarton,
          isNewSku: true,
          skuData: data,
          configLoaded: false,
        }
      })
    )

    toast.success('SKU + Batch will be created with this receive transaction')
  }

  const updateItem = async (id: string, field: keyof LineItem, value: string | number | null) => {
    console.log('updateItem called:', { id, field, value })
    setItems(prevItems => {
      const updated = prevItems.map(item => (item.id === id ? { ...item, [field]: value } : item))
      console.log('Items updated:', updated)
      return updated
    })

    // If SKU code changed, load batches and defaults
    if (field === 'skuCode') {
      if (value) {
        const selectedSku = skus.find(sku => sku.skuCode === value)
        if (selectedSku) {
          await loadBatchesForItem(id, selectedSku)
          await fetchSkuDefaults(id, String(value))
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

  const fetchSkuDefaults = async (itemId: string, skuCode: string) => {
    try {
      if (!warehouseId || !skuCode) {
        setItems(prev =>
          prev.map(item => (item.id === itemId ? { ...item, configLoaded: true } : item))
        )
        return
      }

      const sku = skus.find(s => s.skuCode === skuCode)
      if (!sku) {
        setItems(prev =>
          prev.map(item => (item.id === itemId ? { ...item, configLoaded: true } : item))
        )
        return
      }

      // Fetch warehouse-specific config
      const configResponse = await fetch(
        `/api/warehouse-configs?warehouseId=${warehouseId}&skuId=${sku.id}`,
        {
          credentials: 'include',
        }
      )
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

      setItems(prev =>
        prev.map(item => {
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
        })
      )
    } catch (_error) {
      // console.error('Failed to fetch SKU defaults:', _error)
      setItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, configLoaded: true } : item))
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Cargo Details
            </h3>
            <p className="text-sm text-slate-600 mt-1">Add SKUs and batch information for receiving</p>
          </div>
        </div>

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
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        SKU / Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        New Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Cartons
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Units/Carton
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Storage Config
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Shipping Config
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Pallets
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Total Units
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          {item.isNewSku ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">{item.skuCode}</div>
                                <div className="text-xs text-green-600">✓ New SKU+Batch</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCreateNewSkuBatch(item.id)}
                                className="text-xs text-primary hover:underline whitespace-nowrap"
                                title="Edit SKU+Batch details"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                name={`sku-${item.id}`}
                                value={item.skuCode}
                                onChange={e => updateItem(item.id, 'skuCode', e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
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
                              <button
                                type="button"
                                onClick={() => handleCreateNewSkuBatch(item.id)}
                                className="text-xs text-primary hover:underline whitespace-nowrap"
                                title="Create new SKU+Batch"
                              >
                                + New
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.isNewSku ? (
                            <div className="text-sm font-medium text-slate-900">{item.batchLot || '—'}</div>
                          ) : (() => {
                            const options = item.skuId ? (batchesBySku[item.skuId] ?? []) : []
                            console.log('Batch dropdown render:', { itemId: item.id, skuId: item.skuId, optionsCount: options.length, batchLot: item.batchLot, options })

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
                                value={item.batchLot || ''}
                                onChange={e => {
                                  console.log('Batch selected:', e.target.value)
                                  updateItem(item.id, 'batchLot', e.target.value)
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white text-slate-900"
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
                        <td className="px-6 py-4">
                          <input
                            name={`cartons-${item.id}`}
                            type="number"
                            min="1"
                            value={item.cartons || ''}
                            onChange={e =>
                              updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)
                            }
                            className="w-24 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            required
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            name={`units-per-carton-${item.id}`}
                            type="number"
                            min="1"
                            value={item.unitsPerCarton || ''}
                            onChange={e =>
                              updateItem(item.id, 'unitsPerCarton', parseInt(e.target.value) || 1)
                            }
                            className="w-24 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            placeholder="1"
                            required
                          />
                        </td>
                        <td className="px-6 py-4">
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
                              className={`w-16 px-2 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right ${
                                item.configLoaded && item.storageCartonsPerPallet > 0
                                  ? 'bg-yellow-50'
                                  : ''
                              }`}
                              placeholder={!item.skuCode ? '' : item.configLoaded ? '0' : '...'}
                              title={
                                !item.skuCode
                                  ? 'Select SKU first'
                                  : item.configLoaded && item.storageCartonsPerPallet > 0
                                    ? 'Loaded from warehouse config (editable)'
                                    : 'Enter value'
                              }
                              required
                            />
                            <span className="text-xs text-slate-500">c/p</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
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
                              className={`w-16 px-2 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right ${
                                item.configLoaded && item.shippingCartonsPerPallet > 0
                                  ? 'bg-yellow-50'
                                  : ''
                              }`}
                              placeholder={!item.skuCode ? '' : item.configLoaded ? '0' : '...'}
                              title={
                                !item.skuCode
                                  ? 'Select SKU first'
                                  : item.configLoaded && item.shippingCartonsPerPallet > 0
                                    ? 'Loaded from warehouse config (editable)'
                                    : 'Enter value'
                              }
                              required
                            />
                            <span className="text-xs text-slate-500">c/p</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="0"
                            value={item.storagePalletsIn || ''}
                            onChange={e =>
                              updateItem(item.id, 'storagePalletsIn', parseInt(e.target.value) || 0)
                            }
                            className="w-24 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary text-right"
                            placeholder={
                              item.cartons > 0 && item.storageCartonsPerPallet > 0
                                ? `${Math.ceil(item.cartons / item.storageCartonsPerPallet)}`
                                : ''
                            }
                            title="Storage pallets (auto-calculated, but can be overridden)"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={item.units}
                            className="w-24 px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-50 text-slate-600 text-right"
                            readOnly
                            title="Units are calculated based on cartons × units per carton"
                          />
                        </td>
                        <td className="px-6 py-4">
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
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td className="px-6 py-4 text-right font-semibold text-slate-700" colSpan={2}>
                        Totals:
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        {totals.cartons.toLocaleString()}
                      </td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">{totals.pallets}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        {totals.units.toLocaleString()}
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addNewItem}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add another SKU
                </button>
                <p className="text-sm text-slate-500">
                  Capture multiple SKUs or batches in a single receiving transaction.
                </p>
              </div>
            </>
          )}
      </div>

      {/* SKU+Batch Creation Modal */}
      <CreateSkuBatchModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setCurrentEditingItemId(null)
        }}
        onSave={handleSkuBatchSave}
      />
    </>
  )
}

CargoTab.displayName = 'ReceiveCargoTab'
