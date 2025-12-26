'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  Package2,
  Truck,
  ArrowLeft,
  Loader2,
  FileText,
  DollarSign,
  Paperclip,
} from '@/lib/lucide-icons'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { type ApiAttachment } from '@/components/operations/edit-attachments-tab'
import { TransactionAttachmentsTab } from '@/components/operations/transaction-attachments-tab'

const INVENTORY_LEDGER_PATH = '/operations/inventory'

interface TransactionData {
  id: string
 transactionId: string
 transactionType: 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'
 transactionDate: string
 referenceId: string
 warehouseId: string
 warehouse: {
 id: string
 code: string
 name: string
 }
 shipName?: string
 trackingNumber?: string
 supplier?: string
 pickupDate?: string
 skuCode: string
 cartonsIn: number
 cartonsOut: number
 attachments?: Record<string, ApiAttachment | null>
 calculatedCosts?: Array<{
  id: string
  costCategory?: string
  quantity?: number
  unitRate?: number
  totalCost?: number
 category?: string
 description?: string
 rate?: number
 amount?: number
 }>
 costs?: Array<{
  id?: string
  costType?: string
  costName?: string
  quantity?: number
  unitRate?: number
  totalCost?: number
 }>
 createdBy?: {
  fullName?: string
  email?: string
 }
 history?: Array<Record<string, unknown>>
 lineItems: Array<{
 id: string
 skuId: string
 sku: {
 id: string
 skuCode: string
 description: string
 unitsPerCarton: number
 }
 batchLot: string
 cartonsIn: number
 cartonsOut: number
 storagePalletsIn: number
 shippingPalletsOut: number
 storageCartonsPerPallet?: number
 shippingCartonsPerPallet?: number
 unitsPerCarton?: number
 }>
}

export default function TransactionDetailPage() {
 const params = useParams()
 const router = useRouter()
 const [loading, setLoading] = useState(true)
 const [transaction, setTransaction] = useState<TransactionData | null>(null)
 const [activeTab, setActiveTab] = useState('details')
 const [_skus, setSkus] = useState<Array<{ id: string; skuCode: string; description: string }>>([])
 useEffect(() => {
 loadTransaction()
 loadSkus()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [params.id])

 const loadTransaction = async () => {
 try {
 const response = await fetch(`/api/transactions/${params.id}`, {
 credentials: 'include'
 })

 if (!response.ok) {
 throw new Error('Failed to load transaction')
 }

 const data = await response.json()
 
 
 // Transform the transaction data to match the expected format
 // Since the API returns a single transaction, we need to create lineItems array
 const attachmentsRecord: Record<string, ApiAttachment | null> =
 data.attachments && !Array.isArray(data.attachments)
 ? (data.attachments as Record<string, ApiAttachment | null>)
 : {}

const transformedData: TransactionData = {
 ...data,
 transactionId: data.transactionId || data.referenceId || data.id,
 warehouseId: data.warehouse?.id || data.warehouseId,
 skuCode: data.skuCode || data.sku?.skuCode || '',
 cartonsIn: data.cartonsIn ?? 0,
 cartonsOut: data.cartonsOut ?? 0,
 lineItems: data.lineItems || data.transactionLines || [],
 costs: data.costs || [],
 attachments: attachmentsRecord,
 createdBy: data.createdBy || { fullName: 'System User', email: 'system@warehouse.com' },
 history: data.history || [],
 referenceId: data.referenceId || '',
 shipName: data.shipName || '',
 trackingNumber: data.trackingNumber || '',
 supplier: data.supplier || ''
}
 
 
 setTransaction(transformedData)
 
 } catch (_error) {
 // Error loading transaction
 toast.error('Failed to load transaction')
 } finally {
 setLoading(false)
 }
 }

 const loadSkus = async () => {
 try {
 const response = await fetch('/api/skus', {
 credentials: 'include'
 })
 if (response.ok) {
 const data = await response.json()
 setSkus(data.skus || [])
 }
 } catch (_error) {
 // Failed to load SKUs
 }
 }

 if (loading) {
 return (
 <DashboardLayout>
 <div className="flex items-center justify-center h-96">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 </DashboardLayout>
 )
 }

 if (!transaction) {
 return (
 <DashboardLayout>
 <div className="text-center py-12">
 <p className="text-slate-500">Transaction not found</p>
 <button
 onClick={() => router.push(INVENTORY_LEDGER_PATH)}
 className="mt-4 text-primary hover:underline"
 >
 Return to Inventory
 </button>
 </div>
 </DashboardLayout>
 )
 }

 const isReceive = transaction.transactionType === 'RECEIVE'
 const isShip = transaction.transactionType === 'SHIP'

 // Convert line items to the format expected by cargo tabs
 const cargoItems = transaction.lineItems.map(item => ({
 id: item.id,
 skuCode: item.sku?.skuCode || '',
 skuId: item.skuId,
 batchLot: item.batchLot,
 cartons: isReceive ? item.cartonsIn : item.cartonsOut,
 units: (isReceive ? item.cartonsIn : item.cartonsOut) * (item.unitsPerCarton || 0),
 unitsPerCarton: item.unitsPerCarton || item.sku?.unitsPerCarton || 0,
 storagePalletsIn: item.storagePalletsIn || 0,
 shippingPalletsOut: item.shippingPalletsOut || 0,
 storageCartonsPerPallet: item.storageCartonsPerPallet || 0,
 shippingCartonsPerPallet: item.shippingCartonsPerPallet || 0,
 configLoaded: true,
 loadingBatch: false
 }))
 

 // Tab configuration based on transaction type
 const tabConfig = [
 { id: 'details', label: 'Transaction Details', icon: <FileText className="h-4 w-4" /> },
 { id: 'cargo', label: 'Cargo', icon: <Package2 className="h-4 w-4" /> },
 { id: 'costs', label: 'Costs', icon: <DollarSign className="h-4 w-4" /> },
 { id: 'attachments', label: 'Attachments', icon: <Paperclip className="h-4 w-4" /> }
 ]

 return (
 <DashboardLayout>
 <div className="space-y-2">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <button
 onClick={() => router.push(INVENTORY_LEDGER_PATH)}
 className="p-2 hover:bg-slate-100 rounded-lg"
 >
 <ArrowLeft className="h-5 w-5" />
 </button>
 <div className="flex items-center gap-2">
 {isReceive ? (
 <Package2 className="h-6 w-6 text-slate-600" />
 ) : (
 <Truck className="h-6 w-6 text-slate-600" />
 )}
 <h1 className="text-2xl font-semibold text-slate-900">
 Transaction Details
 </h1>
 <span className={`px-2 py-1 text-xs font-medium rounded-full ${
 isReceive ? 'bg-green-100 text-green-800' : 'bg-cyan-100 text-cyan-800'
 }`}>
 {transaction.transactionType}
 </span>
 <span className="px-2 py-1 text-xs font-mono text-slate-500 bg-slate-100 rounded">
 {transaction.id}
 </span>
 </div>
 </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push(INVENTORY_LEDGER_PATH)}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
        >
          Close
        </button>
      </div>
 </div>

 {/* Tabbed Container */}
 <TabbedContainer
 tabs={tabConfig}
 defaultTab={activeTab}
 onChange={setActiveTab}
 >
 {/* Transaction Details Tab */}
 <TabPanel>
 <div className="space-y-2">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Transaction Date
 </label>
 <input
 type="date"
 value={transaction.transactionDate?.split('T')[0] || ''}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </div>

 <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {isReceive ? 'PI/CI Number' : 'CI/PI Number'}
      </label>
      <input
        type="text"
        value={transaction.referenceId || ''}
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
        readOnly
      />
    </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Warehouse
 </label>
 <input
 type="text"
 value={transaction.warehouse?.name || ''}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </div>

 {isReceive && (
 <>
 <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Ship Name
      </label>
      <input
        type="text"
        value={transaction.shipName || ''}
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
        readOnly
      />
    </div>

 <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Container Number
      </label>
      <input
        type="text"
        value={transaction.trackingNumber || ''}
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
        readOnly
      />
    </div>

 <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Supplier
      </label>
      <input
        type="text"
        value={transaction.supplier || ''}
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
        readOnly
      />
    </div>
 </>
 )}

 {isShip && (
 <>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Pickup Date
 </label>
 <input
 type="date"
 value={transaction.pickupDate?.split('T')[0] || ''}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </div>

 <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Tracking Number
      </label>
      <input
        type="text"
        value={transaction.trackingNumber || ''}
        className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
        readOnly
      />
    </div>

 </>
 )}
 </div>

 </div>
 </TabPanel>

 {/* Cargo Tab - Using actual CargoTab component structure */}
 <TabPanel>
 <div className="space-y-4">
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Batch/Lot</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cartons</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Units</th>
 {isReceive && (
 <>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Storage Pallets In</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Storage Cartons/Pallet</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Shipping Cartons/Pallet</th>
 </>
 )}
 {isShip && (
 <>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Shipping Pallets Out</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Shipping Cartons/Pallet</th>
 </>
 )}
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {cargoItems.map((item, _index) => (
 <tr key={item.id}>
 <td className="px-4 py-3 whitespace-nowrap">
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={item.skuCode}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </div>
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="text"
 value={item.batchLot}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.cartons}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.units}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 {isReceive && (
 <>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.storagePalletsIn}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.storageCartonsPerPallet}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.shippingCartonsPerPallet}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 </>
 )}
 {isShip && (
 <>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.shippingPalletsOut}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={item.shippingCartonsPerPallet}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 </>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </TabPanel>

 {/* Costs Tab */}
 <TabPanel>
 <div className="space-y-6">
 {(!transaction.calculatedCosts || transaction.calculatedCosts.length === 0) ? (
 <div className="text-center py-12 text-slate-500">
 <p>No costs recorded for this transaction</p>
 <p className="text-sm mt-2">Costs need to be saved when creating the transaction</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cost Category</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quantity</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unit Rate</th>
 <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cost</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {transaction.calculatedCosts.map((cost, index) => (
 <tr key={index}>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="text"
 value={cost.costCategory ?? cost.category ?? ''}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={cost.quantity ?? 0}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={cost.unitRate ?? cost.rate ?? 0}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 <td className="px-4 py-3 whitespace-nowrap">
 <input
 type="number"
 value={cost.totalCost ?? cost.amount ?? 0}
 className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50"
 readOnly
 />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </TabPanel>

    {/* Attachments Tab */}
    <TabPanel>
      <TransactionAttachmentsTab
        transactionId={transaction.id}
        transactionType={transaction.transactionType}
      />
    </TabPanel>
 </TabbedContainer>
 </div>

 </DashboardLayout>
 )
}
