'use client'

// React imports
import { useState, useEffect, useCallback } from 'react'

// Next.js imports
import { useRouter } from 'next/navigation'

// Third-party libraries
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/usePortalSession'

// Internal components
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { CargoTab } from '@/components/operations/ship-cargo-tab'
import { AttachmentsTab } from '@/components/operations/ship-attachments-tab'

// Internal utilities
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
import { Package2, FileText, Paperclip, Save, X, PackageX } from '@/lib/lucide-icons'

// Types
interface WarehouseOption {
 id: string
 name: string
 code: string
}

type ShipMode = 'PALLETS' | 'CARTONS'

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
 shipMode: ShipMode | ''
 notes: string
 warehouseId: string
}

interface ValidationErrors {
 details: boolean
 lineItems: boolean
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
 shipMode: '',
 notes: '',
 warehouseId: ''
}

const initialValidationErrors: ValidationErrors = {
 details: false,
 lineItems: false
}

// Tab configuration (removed - will be dynamic based on warehouse selection)

export default function ShipTabbedPage() {
 const router = useRouter()
const PURCHASE_ORDERS_PATH = '/operations/orders'
 const { data: session } = useSession()
 
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
 }))
 }

 // Run validation
 const validationResult = validateTransaction(validationData, false)

 // Update validation errors state
 const errors: ValidationErrors = {
 details: validationResult.errors.some(e => ['transactionDate', 'warehouseId', 'referenceNumber', 'pickupDate'].includes(e.field)),
 lineItems: validationResult.errors.some(e => e.field.startsWith('items')),
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
 }
 
 return false
 }

 return true
 }

 const handleSubmit = async () => {
	 if (!formData.shipMode) {
	 toast.error('Please select an outbound mode')
	 setActiveTab('details')
	 return
	 }

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
 skuCode: item.skuCode, // Added skuCode which is required by API
 skuId: item.skuId,
 batchLot: item.batchLot,
 cartons: item.cartons, // Use 'cartons' instead of 'cartonsOut'
 cartonsOut: item.cartons, // Also send cartonsOut for backward compatibility
 pallets: item.pallets, // Use 'pallets' instead of 'shippingPalletsOut' 
 shippingPalletsOut: item.pallets, // Also send shippingPalletsOut for backward compatibility
 storageCartonsPerPallet: item.storageCartonsPerPallet,
 shippingCartonsPerPallet: item.shippingCartonsPerPallet,
 unitsPerCarton: item.unitsPerCarton
 }
 }),
 attachments,
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
 router.push(PURCHASE_ORDERS_PATH)
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
 router.push(PURCHASE_ORDERS_PATH)
 }
 } else {
 router.push(PURCHASE_ORDERS_PATH)
 }
 }

 // Dynamic tab configuration based on warehouse selection
 const tabConfig = [
 { id: 'details', label: 'Transaction Details', icon: <FileText className="h-4 w-4" /> },
 ...(formData.warehouseId ? [
 { id: 'cargo', label: 'Cargo', icon: <Package2 className="h-4 w-4" /> },
 { id: 'attachments', label: 'Attachments', icon: <Paperclip className="h-4 w-4" /> }
 ] : [])
 ]

 return (
 <DashboardLayout>
 <PageContainer>
 <PageHeaderSection
	 title="Outbound Inventory"
 description="Operations"
 icon={PackageX}
 actions={
 <div className="flex gap-2">
 <button
 onClick={handleCancel}
 className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100"
 >
 <X className="mr-2 inline h-4 w-4" />
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={isSubmitting}
 className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-cyan-700 disabled:opacity-50"
 >
 <Save className="mr-2 inline h-4 w-4" />
 {isSubmitting ? 'Creating...' : 'Create Transaction'}
 </button>
 </div>
 }
 />
 <PageContent>

 {/* Tabbed Content */}
 <TabbedContainer
 tabs={tabConfig}
 defaultTab={activeTab}
 onChange={setActiveTab}
 >
 {/* Transaction Details Tab */}
 <TabPanel>
 <div className="bg-white rounded-lg border border-slate-200">
 <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
 <h3 className="text-base font-semibold text-slate-900">Transaction Information</h3>
	 <p className="text-sm text-slate-600 mt-1">Enter the basic details for this outbound transaction</p>
 </div>

 <div className="p-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Transaction Date & Time *
 </label>
 <input
 type="datetime-local"
 value={formData.transactionDate}
 onChange={(e) => updateFormField('transactionDate', e.target.value)}
 max={(() => {
 const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
 return maxDate.toISOString().slice(0, 16)
 })()}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Warehouse *
 </label>
 <select
 value={formData.warehouseId}
 onChange={(e) => updateFormField('warehouseId', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
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
 <label className="block text-sm font-medium text-slate-700 mb-2">
 PO # * <span className="text-xs text-slate-500 font-normal">(Reference Number / FBA Shipment ID)</span>
 </label>
 <input
 type="text"
 value={formData.referenceNumber}
 onChange={(e) => updateFormField('referenceNumber', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="e.g., FBA15B2GWV8"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Destination <span className="text-xs text-slate-500 font-normal">(Warehouse Code)</span>
 </label>
 <input
 type="text"
 value={formData.destination}
 onChange={(e) => updateFormField('destination', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="e.g., BHX4"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
	 Outbound Mode *
 </label>
 <select
 value={formData.shipMode}
 onChange={(e) => updateFormField('shipMode', e.target.value as ShipmentFormData['shipMode'])}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 >
	 <option value="">Select outbound mode</option>
 <option value="PALLETS">Pallets</option>
 <option value="CARTONS">Cartons</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Tracking Number
 </label>
 <input
 type="text"
 value={formData.trackingNumber}
 onChange={(e) => updateFormField('trackingNumber', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="Carrier tracking number"
 />
 </div>

 <div className="col-span-1 md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Notes
 </label>
 <textarea
 value={formData.notes}
 onChange={(e) => updateFormField('notes', e.target.value)}
 rows={3}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
 placeholder="Additional notes or instructions"
 />
 </div>
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

 {/* Attachments Tab */}
 <TabPanel>
 <AttachmentsTab
 onAttachmentsChange={setAttachments}
 />
 </TabPanel>
 </TabbedContainer>
 </PageContent>
 </PageContainer>
 </DashboardLayout>
 )
}
