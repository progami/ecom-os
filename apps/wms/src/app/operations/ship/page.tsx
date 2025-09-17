'use client'

// React imports
import { useState, useEffect, useCallback, useRef } from 'react'

// Next.js imports
import { useRouter } from 'next/navigation'

// Third-party libraries
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'

// Internal components
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { ShipCostsTab, CostsTabRef } from '@/components/operations/ship-costs-tab'
import { CargoTab } from '@/components/operations/ship-cargo-tab'
import { AttachmentsTab } from '@/components/operations/ship-attachments-tab'

// Internal utilities
import { sumBy } from '@/lib/utils/calculations'
type ValidationErrorItem = { field: string; message?: string }
type ValidationResult = { isValid: boolean; errors: ValidationErrorItem[] }

// Temporary validation functions
const validateTransaction = (_data: Record<string, unknown>, _isEdit: boolean): ValidationResult => ({
  isValid: true,
  errors: []
})

const displayValidationErrors = (errors: ValidationErrorItem[]) => {
  errors.forEach(error => {
    toast.error(error.message || error.field)
  })
}

const _getFieldError = (errors: ValidationErrorItem[], field: string) =>
  errors.find(error => error.field === field)?.message

// Icons
import { Package2, FileText, DollarSign, Paperclip, Save, X, Truck } from '@/lib/lucide-icons'

// Types
interface WarehouseOption {
  id: string
  name: string
  code: string
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
  sku: {
    id: string
    skuCode: string
    description: string
    unitsPerCarton: number
  }
}

interface ShipmentLineItem {
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

interface FileAttachment {
  name: string
  type: string
  size: number
  data?: string
  category: string
}

interface ShipmentFormData {
  transactionDate: string
  referenceNumber: string
  destination: string
  trackingNumber: string
  pickupDate: string
  notes: string
  warehouseId: string
}

interface ValidationErrors {
  details: boolean
  lineItems: boolean
  costs: boolean
}

// Helper to get current datetime in local timezone for input
const getCurrentDateTime = () => {
  const now = new Date()
  // Use UTC time directly - no timezone adjustment
  return now.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm in UTC
}

const initialFormData: ShipmentFormData = {
  transactionDate: '',
  referenceNumber: '',
  destination: '',
  trackingNumber: '',
  pickupDate: '',
  notes: '',
  warehouseId: ''
}

const initialValidationErrors: ValidationErrors = {
  details: false,
  lineItems: false,
  costs: false
}

// Tab configuration (removed - will be dynamic based on warehouse selection)

export default function ShipTabbedPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const costsTabRef = useRef<CostsTabRef>(null)
  
  // Core state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  
  // Form data consolidated into single state
  const [formData, setFormData] = useState<ShipmentFormData>(() => ({
    ...initialFormData,
    transactionDate: getCurrentDateTime(),
    pickupDate: getCurrentDateTime()
  }))
  
  // Related data states
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [lineItems, setLineItems] = useState<ShipmentLineItem[]>([])
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  
  // Loading states
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  
  // Validation
  const [_validationErrors, setValidationErrors] = useState<ValidationErrors>(initialValidationErrors)

  // Helper function to update form data
  const updateFormField = useCallback(<K extends keyof ShipmentFormData>(
    field: K, 
    value: ShipmentFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Fetch warehouses on mount
  useEffect(() => {
    fetchWarehouses()
  }, [])

  // Fetch inventory when warehouse or transaction date changes
  useEffect(() => {
    if (formData.warehouseId) {
      fetchInventory(formData.warehouseId, formData.transactionDate)
    } else {
      setInventory([])
    }
  }, [formData.warehouseId, formData.transactionDate])

  // Auto-select warehouse if user has one assigned
  useEffect(() => {
    if (session?.user?.warehouseId && warehouses.length > 0) {
      const userWarehouse = warehouses.find(w => w.id === session.user.warehouseId)
      if (userWarehouse && !formData.warehouseId) {
        updateFormField('warehouseId', userWarehouse.id)
      }
    }
  }, [session, warehouses, formData.warehouseId, updateFormField])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses', { credentials: 'include' })
      const data = await response.json()
      setWarehouses(Array.isArray(data) ? data : [])
    } catch (_error) {
      toast.error('Failed to load warehouses')
      setWarehouses([])
    }
  }

  const fetchInventory = async (warehouseId: string, transactionDate?: string) => {
    setIsLoadingInventory(true)
    try {
      // Include transaction date to get point-in-time inventory
      const url = transactionDate 
        ? `/api/inventory/balances?warehouseId=${warehouseId}&date=${transactionDate}`
        : `/api/inventory/balances?warehouseId=${warehouseId}`
      
      const response = await fetch(url, { 
        credentials: 'include' 
      })
      const payload = await response.json()
      
      const inventoryData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : []
      setInventory(inventoryData)
    } catch (_error) {
      toast.error('Failed to load inventory')
      setInventory([])
    } finally {
      setIsLoadingInventory(false)
    }
  }

  const validateForm = (): boolean => {
    // Get costs from the costs tab
    const costsResult = costsTabRef.current?.getValidatedCosts()
    const costs = (!costsResult || 'error' in costsResult) ? [] : costsResult

    // Prepare data for validation
    const validationData = {
      transactionType: 'SHIP' as const,
      transactionDate: formData.transactionDate,
      warehouseId: formData.warehouseId,
      referenceNumber: formData.referenceNumber,
      pickupDate: formData.pickupDate,
      items: lineItems.map(item => ({
        skuCode: item.skuCode,
        skuId: item.skuId,
        batchLot: item.batchLot,
        cartonsOut: item.cartons,
        shippingPalletsOut: item.pallets,
        unitsPerCarton: item.unitsPerCarton,
        shippingCartonsPerPallet: item.shippingCartonsPerPallet
      })),
      costs: costs.map(cost => ({
        costType: cost.costType,
        costName: cost.costName,
        quantity: cost.quantity,
        unitRate: cost.unitRate,
        totalCost: cost.totalCost
      }))
    }

    // Run validation
    const validationResult = validateTransaction(validationData, false)

    // Update validation errors state
    const errors: ValidationErrors = {
      details: validationResult.errors.some(e => ['transactionDate', 'warehouseId', 'referenceNumber', 'pickupDate'].includes(e.field)),
      lineItems: validationResult.errors.some(e => e.field.startsWith('items')),
      costs: validationResult.errors.some(e => e.field.startsWith('costs'))
    }
    setValidationErrors(errors)

    // Display errors
    if (!validationResult.isValid) {
      displayValidationErrors(validationResult.errors)
      
      // Switch to the appropriate tab
      if (errors.details) {
        setActiveTab('details')
      } else if (errors.lineItems) {
        setActiveTab('cargo')
      } else if (errors.costs) {
        setActiveTab('costs')
      }
      
      return false
    }

    // Additional check for costs from ref
    if (!costsResult || 'error' in costsResult) {
      toast.error((costsResult && 'error' in costsResult ? costsResult.error : null) || 'Please review and complete the Costs tab')
      setActiveTab('costs')
      return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    
    try {
      // Debug: Check what's in lineItems
      // console.log('LineItems before submit:', lineItems)
      
      // Prepare transaction data
      const transactionData = {
        ...formData,
        transactionType: 'SHIP',
        lineItems: lineItems.map(item => {
          // Debug each item
          // console.log('Processing item:', item)
          
          return {
            skuCode: item.skuCode,  // Added skuCode which is required by API
            skuId: item.skuId,
            batchLot: item.batchLot,
            cartons: item.cartons,  // Use 'cartons' instead of 'cartonsOut'
            cartonsOut: item.cartons,  // Also send cartonsOut for backward compatibility
            pallets: item.pallets,  // Use 'pallets' instead of 'shippingPalletsOut' 
            shippingPalletsOut: item.pallets,  // Also send shippingPalletsOut for backward compatibility
            storageCartonsPerPallet: item.storageCartonsPerPallet,
            shippingCartonsPerPallet: item.shippingCartonsPerPallet,
            unitsPerCarton: item.unitsPerCarton
          }
        }),
        attachments,
        costs: (() => {
          const costsResult = costsTabRef.current?.getValidatedCosts()
          if (!costsResult || 'error' in costsResult) {
            return []
          }
          return costsResult
        })()
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to create transaction')
      }

      const result = await response.json()
      
      toast.success('Transaction created successfully!')
      // Redirect to the first transaction created (typically there's only one for ship)
      if (result.transactionIds && result.transactionIds.length > 0) {
        router.push(`/operations/transactions/${result.transactionIds[0]}`)
      } else {
        router.push('/operations/inventory')
      }
    } catch (_error) {
      toast.error(_error instanceof Error ? _error.message : 'Failed to create transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (lineItems.length > 0 || attachments.length > 0 || formData.referenceNumber) {
      if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
        router.push('/operations/inventory')
      }
    } else {
      router.push('/operations/inventory')
    }
  }

  // Dynamic tab configuration based on warehouse selection
  const tabConfig = [
    { id: 'details', label: 'Transaction Details', icon: <FileText className="h-4 w-4" /> },
    ...(formData.warehouseId ? [
      { id: 'cargo', label: 'Cargo', icon: <Package2 className="h-4 w-4" /> },
      { id: 'costs', label: 'Costs', icon: <DollarSign className="h-4 w-4" /> },
      { id: 'attachments', label: 'Attachments', icon: <Paperclip className="h-4 w-4" /> }
    ] : [])
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-gray-600" />
            <h1 className="text-2xl font-semibold text-gray-900">New Shipment</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2 inline" />
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2 inline" />
              {isSubmitting ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </div>

        {/* Tabbed Content */}
        <TabbedContainer
          tabs={tabConfig}
          defaultTab={activeTab}
          onChange={setActiveTab}
        >
          {/* Transaction Details Tab */}
          <TabPanel>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.transactionDate}
                    onChange={(e) => updateFormField('transactionDate', e.target.value)}
                    max={(() => {
                      const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                      // Use UTC time directly - no timezone adjustment
                      return maxDate.toISOString().slice(0, 16)
                    })()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warehouse *
                  </label>
                  <select
                    value={formData.warehouseId}
                    onChange={(e) => updateFormField('warehouseId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map(warehouse => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number * <span className="text-xs text-gray-500">(FBA Shipment ID)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.referenceNumber}
                    onChange={(e) => updateFormField('referenceNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    placeholder="e.g., FBA15B2GWV8"
                    title="Enter FBA Shipment ID or similar tracking reference"
                    required
                  />
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination <span className="text-xs text-gray-500">(Warehouse Code)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => updateFormField('destination', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    placeholder="e.g., BHX4"
                    title="Enter destination warehouse code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={formData.trackingNumber}
                    onChange={(e) => updateFormField('trackingNumber', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    placeholder="Carrier tracking number"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateFormField('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary"
                    placeholder="Additional notes or instructions"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Cargo Tab */}
          <TabPanel>
            <CargoTab
              warehouseId={formData.warehouseId}
              inventory={inventory}
              inventoryLoading={isLoadingInventory}
              onItemsChange={setLineItems}
            />
          </TabPanel>

          {/* Costs Tab */}
          <TabPanel>
            <ShipCostsTab
              ref={costsTabRef}
              warehouseId={formData.warehouseId}
              totalCartons={sumBy(lineItems, 'cartons')}
              totalPallets={sumBy(lineItems, 'pallets')}
            />
          </TabPanel>

          {/* Attachments Tab */}
          <TabPanel>
            <AttachmentsTab
              onAttachmentsChange={setAttachments}
            />
          </TabPanel>
        </TabbedContainer>
      </div>
    </DashboardLayout>
  )
}
