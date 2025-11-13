'use client'

// React imports
import { useState, useEffect, useCallback, useRef } from 'react'

// Next.js imports
import { useRouter } from 'next/navigation'

// Third-party libraries
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/usePortalSession'

// Internal components
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { ReceiveCostsTab, CostsTabRef } from '@/components/operations/receive-costs-tab'
import { CargoTab } from '@/components/operations/receive-cargo-tab'
import { AttachmentsTab } from '@/components/operations/receive-attachments-tab'

// Internal utilities
import { sumBy } from '@/lib/utils/calculations'
// Temporary validation functions
const validateTransaction = (_data: Record<string, unknown>, _isEdit: boolean) => ({
 isValid: true,
 errors: []
})
const displayValidationErrors = (errors: Array<{ field?: string; message: string }> | Record<string, string>) => {
 if (!errors) return
 
 if (Array.isArray(errors)) {
 errors.forEach((error: { field?: string; message: string }) => {
 if (error?.message) {
 toast.error(String(error.message))
 } else if (typeof error === 'string') {
 toast.error(error)
 }
 })
 } else if (typeof errors === 'object') {
 Object.values(errors).forEach((error: string) => {
 if (error) toast.error(String(error))
 })
 }
}
const _getFieldError = (errors: Record<string, string>, field: string) => errors[field]

// Icons
import { Package2, FileText, DollarSign, Paperclip, Save, X, PackageCheck } from '@/lib/lucide-icons'

// Types
interface WarehouseOption {
 id: string
 name: string
 code: string
}

interface Sku {
 id: string
 skuCode: string
 description: string
 unitsPerCarton: number
}

interface NewSkuBatchData {
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
 batchCode: string
 batchDescription?: string
}

interface ReceiveLineItem {
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
 isNewSku?: boolean
 skuData?: NewSkuBatchData
}

interface FileAttachment {
 name: string
 type: string
 size: number
 data?: string
 category: string
 file?: File
}

interface LinkedPurchaseOrderLine {
 id: string
 skuCode: string
 skuDescription: string | null
 batchLot: string | null
 quantity: number
 postedQuantity: number
}

interface _LinkedPurchaseOrderSummary {
 id: string
 orderNumber: string
 warehouseCode: string
 warehouseName: string
 status: 'DRAFT' | 'AWAITING_PROOF' | 'REVIEW' | 'POSTED' | 'CANCELLED' | 'CLOSED'
 type: 'PURCHASE' | 'FULFILLMENT' | 'ADJUSTMENT'
 counterpartyName: string | null
 expectedDate: string | null
 lines: LinkedPurchaseOrderLine[]
}

interface ReceiveFormData {
 transactionDate: string
 referenceNumber: string
 shipName: string
 containerNumber: string
 supplier: string
 notes: string
 warehouseId: string
}

interface ValidationErrors {
 details: boolean
 lineItems: boolean
 costs: boolean
}

// Helper to get current datetime in UTC
const getCurrentDateTime = () => {
 const now = new Date()
 // Use UTC time directly - no timezone adjustment
 return now.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm in UTC
}

const initialFormData: ReceiveFormData = {
 transactionDate: '',
 referenceNumber: '',
 shipName: '',
 containerNumber: '',
 supplier: '',
 notes: '',
 warehouseId: ''
}

const initialValidationErrors: ValidationErrors = {
 details: false,
 lineItems: false,
 costs: false
}

// Tab configuration (removed - will be dynamic based on warehouse selection)

export default function ReceiveTabbedPage() {
 const router = useRouter()
const PURCHASE_ORDERS_PATH = '/operations/orders'
 const { data: session } = useSession()
 const costsTabRef = useRef<CostsTabRef>(null)
 
 // Core state
 const [isSubmitting, setIsSubmitting] = useState(false)
 const [activeTab, setActiveTab] = useState('details')
 
 // Form data consolidated into single state
 const [formData, setFormData] = useState<ReceiveFormData>(() => ({
 ...initialFormData,
 transactionDate: getCurrentDateTime()
 }))
 
 // Related data states
 const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
 const [skus, setSkus] = useState<Sku[]>([])
 const [lineItems, setLineItems] = useState<ReceiveLineItem[]>([])
 const [attachments, setAttachments] = useState<FileAttachment[]>([])
 
 // Validation
 const [_validationErrors, setValidationErrors] = useState<ValidationErrors>(initialValidationErrors)

 // Helper function to update form data
 const updateFormField = useCallback(<K extends keyof ReceiveFormData>(
 field: K, 
 value: ReceiveFormData[K]
 ) => {
 setFormData(prev => ({ ...prev, [field]: value }))
 }, [])

 // Fetch warehouses on mount
 useEffect(() => {
 fetchWarehouses()
 fetchSkus()
 }, [])

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

 const fetchSkus = async () => {
 try {
 const response = await fetch('/api/skus', { credentials: 'include' })
 const data = await response.json()
 // API already returns camelCase, no transformation needed
 const transformedData = Array.isArray(data) ? data.map(sku => ({
 id: sku.id,
 skuCode: sku.skuCode,
 description: sku.description,
 unitsPerCarton: sku.unitsPerCarton || 1,
 packSize: sku.packSize,
 asin: sku.asin,
 material: sku.material,
 unitDimensionsCm: sku.unitDimensionsCm,
 unitWeightKg: sku.unitWeightKg,
 cartonDimensionsCm: sku.cartonDimensionsCm,
 cartonWeightKg: sku.cartonWeightKg,
 packagingType: sku.packagingType,
 isActive: sku.isActive
 })) : []
 setSkus(transformedData)
 } catch (_error) {
 toast.error('Failed to load SKUs')
 setSkus([])
 }
 }

 // Calculate totals
 const totalCartons = lineItems ? sumBy(lineItems, 'cartons') : 0
 const totalPallets = lineItems ? sumBy(lineItems, 'storagePalletsIn') : 0


 const validateForm = (): boolean => {
 // Get costs from the costs tab
 const costsResult = costsTabRef.current?.getValidatedCosts()
 const costs = (!costsResult || 'error' in costsResult) ? [] : costsResult

 // Prepare data for validation
 const validationData = {
 transactionType: 'RECEIVE' as const,
 transactionDate: formData.transactionDate,
 warehouseId: formData.warehouseId,
 referenceNumber: formData.referenceNumber,
 items: (lineItems || []).map(item => ({
 skuCode: item.skuCode,
 skuId: item.skuId,
 batchLot: item.batchLot,
 cartonsIn: item.cartons,
 storagePalletsIn: item.storagePalletsIn,
 unitsPerCarton: item.unitsPerCarton,
 storageCartonsPerPallet: item.storageCartonsPerPallet
 })),
 costs: (costs || []).map(cost => ({
 costType: cost.costType,
 quantity: cost.quantity,
 unitRate: cost.unitRate,
 totalCost: cost.totalCost
 }))
 }

 // Run validation
 const validationResult = validateTransaction(validationData, false)
 
 // console.log('Validation result:', validationResult)
 // console.log('Validation errors:', validationResult.errors)
 // console.log('Is errors an array?', Array.isArray(validationResult.errors))

 // Update validation errors state
 const errorsArray = validationResult?.errors || []
 const hasErrors = Array.isArray(errorsArray) && errorsArray.length > 0
 const errors: ValidationErrors = {
 details: hasErrors ? 
 errorsArray.some((e: { field?: string }) => e?.field && ['transactionDate', 'warehouseId', 'referenceNumber'].includes(e.field)) : false,
 lineItems: hasErrors ? 
 errorsArray.some((e: { field?: string }) => e?.field && typeof e.field === 'string' && e.field.startsWith('items')) : false,
 costs: hasErrors ? 
 errorsArray.some((e: { field?: string }) => e?.field && typeof e.field === 'string' && e.field.startsWith('costs')) : false
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
 // console.log('=== handleSubmit START ===')
 // console.trace('Stack trace')
 
 // Prevent multiple submissions
 if (isSubmitting) {
 // console.log('Already submitting, ignoring duplicate click')
 return
 }
 
 // Check if we have line items
 if (!lineItems || lineItems.length === 0) {
 toast.error('Please add at least one line item in the Cargo tab')
 setActiveTab('cargo')
 return
 }
 
 // console.log('lineItems check passed:', lineItems.length, 'items')

 // Check required fields
 if (!formData.referenceNumber) {
 toast.error('Please enter a PI/CI/PO number')
 setActiveTab('details')
 return
 }

 if (!formData.warehouseId) {
 toast.error('Please select a warehouse')
 setActiveTab('details')
 return
 }

 // console.log('About to validate form')
 try {
 if (!validateForm()) {
 // console.log('Validation failed')
 return
 }
 // console.log('Validation passed')
 } catch (validationError) {
 // console.error('Error during validation:', validationError)
 // console.trace('Validation error stack')
 toast.error('Validation error: ' + validationError.message)
 return
 }

 setIsSubmitting(true)
 
 try {
 // Get and validate costs first
 const costsResult = costsTabRef.current?.getValidatedCosts()
 if (costsResult && 'error' in costsResult) {
 toast.error(costsResult.error)
 setIsSubmitting(false)
 return
 }
 
 // Prepare transaction data - API expects 'items' not 'lineItems'
 const transactionData = {
 transactionDate: formData.transactionDate,
 referenceNumber: formData.referenceNumber,
 shipName: formData.shipName,
 containerNumber: formData.containerNumber,
 supplier: formData.supplier,
 notes: formData.notes,
 warehouseId: formData.warehouseId,
 transactionType: 'RECEIVE',
 trackingNumber: formData.containerNumber,
 lineItems: (lineItems || []).map(item => ({
 skuId: item.skuId,
 skuCode: item.skuCode,
 batchLot: item.batchLot,
 cartonsIn: item.cartons,
 storagePalletsIn: item.storagePalletsIn,
 storageCartonsPerPallet: item.storageCartonsPerPallet,
 shippingCartonsPerPallet: item.shippingCartonsPerPallet,
 unitsPerCarton: item.unitsPerCarton,
 // New SKU+Batch creation fields
 isNewSku: item.isNewSku || false,
 skuData: item.isNewSku ? item.skuData : undefined,
    batchData: item.isNewSku ? {
      batchCode: item.batchLot,
      description: item.skuData?.batchDescription,
      isActive: true
    } : undefined
 })),
 attachments,
 costs: Array.isArray(costsResult) ? costsResult : []
 }
 
 // Debug log to see what's being sent
 // console.log('=== SENDING TRANSACTION FROM FRONTEND ===')
 // console.log('lineItems count:', lineItems?.length)
 // console.log('Transaction type:', transactionData.transactionType)
 // console.log('Warehouse:', transactionData.warehouseId)

 const requestBody = JSON.stringify(transactionData)
 // console.log('=== ACTUAL REQUEST BODY ===')
 // console.log(requestBody)
 // console.log('Body includes "items":', requestBody.includes('"items"'))
 // console.log('Body includes "lineItems":', requestBody.includes('"lineItems"'))
 
 const response = await fetch('/api/transactions', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: requestBody,
 credentials: 'include'
 })

 if (!response.ok) {
 let error
 try {
 error = await response.json()
 } catch (_e) {
 error = { error: 'Failed to parse error response' }
 }
 // console.error('Transaction API error:', error)
 throw new Error(error?.error || error?.message || 'Failed to create transaction')
 }

 const result = await response.json()
 // console.log('Transaction API response:', result)
 
 // Upload attachments to S3 using presigned URLs (avoids nginx limits)
 if (result && result.transactionIds && Array.isArray(result.transactionIds) && result.transactionIds.length > 0 && attachments && attachments.length > 0) {
 const transactionId = result.transactionIds[0] // Use transaction ID for attachment upload
 const attachmentsWithFiles = attachments.filter(att => att.file)
 
 if (attachmentsWithFiles && attachmentsWithFiles.length > 0) {
 try {
 for (const attachment of attachmentsWithFiles) {
 // Step 1: Get presigned URL
 const presignedResponse = await fetch('/api/upload/generate-presigned-url', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 fileName: attachment.name,
 fileType: attachment.type,
 fileSize: attachment.size,
 context: {
 type: 'transaction',
 transactionId,
 documentType: attachment.category
 }
 }),
 credentials: 'include'
 })
 
 if (!presignedResponse.ok) {
 // console.error('Failed to get presigned URL for:', attachment.name)
 continue
 }
 
 const { uploadUrl, s3Key } = await presignedResponse.json()
 
 // Step 2: Upload directly to S3 using presigned URL
 const uploadResponse = await fetch(uploadUrl, {
 method: 'PUT',
 body: attachment.file,
 headers: {
 'Content-Type': attachment.type
 }
 })
 
 if (!uploadResponse.ok) {
 // console.error('Failed to upload to S3:', attachment.name)
 continue
 }
 
 // Step 3: Update transaction with attachment metadata
 await fetch(`/api/transactions/${transactionId}/attachments`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 s3Key,
 fileName: attachment.name,
 fileType: attachment.type,
 fileSize: attachment.size,
 documentType: attachment.category
 }),
 credentials: 'include'
 })
 }
 } catch (_uploadError) {
 // console.error('Error uploading attachments:', uploadError)
 // Don't fail the transaction, just log the error
 }
 }
 }
 
 toast.success('Transaction created successfully!')
 // Redirect to transaction detail page
 if (result && result.transactionIds && Array.isArray(result.transactionIds) && result.transactionIds.length > 0) {
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
 if ((lineItems && lineItems.length > 0) || (attachments && attachments.length > 0) || formData.referenceNumber) {
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
 { id: 'costs', label: 'Costs', icon: <DollarSign className="h-4 w-4" /> },
 { id: 'attachments', label: 'Attachments', icon: <Paperclip className="h-4 w-4" /> }
 ] : [])
 ]

 return (
 <DashboardLayout>
 <PageContainer>
 <PageHeaderSection
 title="Receive Inventory"
 description="Operations"
 icon={PackageCheck}
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
 <p className="text-sm text-slate-600 mt-1">Enter the basic details for this receive transaction</p>
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
 PO # * <span className="text-xs text-slate-500 font-normal">(Reference Number / Commercial Invoice)</span>
 </label>
 <input
 type="text"
 value={formData.referenceNumber}
 onChange={(e) => updateFormField('referenceNumber', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="e.g., CI-12345"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Ship Name
 </label>
 <input
 type="text"
 value={formData.shipName}
 onChange={(e) => updateFormField('shipName', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="Enter ship or vessel name"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Container Number
 </label>
 <input
 type="text"
 value={formData.containerNumber}
 onChange={(e) => updateFormField('containerNumber', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="XXXX-XXXXXXX-X"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Supplier
 </label>
 <input
 type="text"
 value={formData.supplier}
 onChange={(e) => updateFormField('supplier', e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
 placeholder="Enter supplier name"
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
 skus={skus}
 onItemsChange={setLineItems}
 />
 </TabPanel>

 {/* Costs Tab */}
 <TabPanel>
 <ReceiveCostsTab
 ref={costsTabRef}
 warehouseId={formData.warehouseId}
 totalCartons={totalCartons}
 totalPallets={totalPallets}
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
