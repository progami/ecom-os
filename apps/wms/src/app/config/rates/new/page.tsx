'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { DollarSign, Save, X } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { redirectToPortal } from '@/lib/portal'

interface Warehouse {
 id: string
 name: string
 code: string
}

export default function NewRatePage() {
 return (
 <Suspense
 fallback={
 <DashboardLayout>
 <div className="p-6">Loading rate form...</div>
 </DashboardLayout>
 }
 >
 <NewRatePageContent />
 </Suspense>
 )
}

const costCategories = [
 { value: 'Storage', label: 'Storage', description: 'Storage charges (pallet/week or cubic foot/month)' },
 { value: 'Container', label: 'Container', description: 'Container handling charges' },
 { value: 'Carton', label: 'Carton', description: 'Per carton handling' },
 { value: 'Pallet', label: 'Pallet', description: 'Pallet movement charges' },
 { value: 'Unit', label: 'Unit', description: 'Individual unit handling' },
 { value: 'Shipment', label: 'Shipment', description: 'Per shipment/order charges' },
 { value: 'Accessorial', label: 'Accessorial', description: 'Additional services' }
]

const unitsByCategory: { [key: string]: string[] } = {
 Storage: ['pallet/week', 'cubic foot/month'],
 Container: ['container', '20ft', '40ft', 'hc'],
 Carton: ['carton', 'case'],
 Pallet: ['pallet', 'pallet/in', 'pallet/out'],
 Unit: ['unit', 'piece', 'item'],
 Shipment: ['shipment', 'order', 'delivery'],
 Accessorial: ['hour', 'service', 'fee', 'charge']
}

function NewRatePageContent() {
 const router = useRouter()
 const searchParams = useSearchParams()
 const { data: session, status } = useSession()
 const [loading, setLoading] = useState(false)
 const [warehouses, setWarehouses] = useState<Warehouse[]>([])
 const [checkingOverlap, setCheckingOverlap] = useState(false)
 
 const [formData, setFormData] = useState({
   warehouseId: '',
   costCategory: '',
   costValue: '',
   unitOfMeasure: '',
   effectiveDate: new Date().toISOString().split('T')[0],
 endDate: ''
 })

 useEffect(() => {
 if (status === 'loading') return
 if (!session || session.user.role !== 'admin') {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    redirectToPortal('/login', `${window.location.origin}${basePath}/config/rates/new`)
 return
 }
 fetchWarehouses()
 }, [session, status, router])

 useEffect(() => {
 const warehouseId = searchParams.get('warehouseId')
 if (!warehouseId) return
 if (!warehouses.some((warehouse) => warehouse.id === warehouseId)) return
 setFormData((current) => {
 if (current.warehouseId) return current
 return { ...current, warehouseId }
 })
 }, [searchParams, warehouses])

 const fetchWarehouses = async () => {
 try {
 const response = await fetchWithCSRF('/api/warehouses')
 if (response.ok) {
 const data = await response.json()
 setWarehouses(data)
 }
 } catch (_error) {
 toast.error('Failed to load warehouses')
 }
 }

 const checkForOverlap = async () => {
  if (!formData.warehouseId || !formData.costCategory || !formData.effectiveDate) {
    return true // Allow submission to show validation errors
  }

 setCheckingOverlap(true)
 try {
 const response = await fetchWithCSRF('/api/settings/rates/check-overlap', {
 method: 'POST',
  body: JSON.stringify({
    warehouseId: formData.warehouseId,
    costCategory: formData.costCategory
  })
})

 if (response.ok) {
 const { hasOverlap, message } = await response.json()
 if (hasOverlap) {
 toast.error(message || 'This rate overlaps with an existing rate')
 return false
 }
 }
 return true
 } catch (_error) {
 // console.error('Error checking overlap:', error)
 return true // Allow submission on error
 } finally {
 setCheckingOverlap(false)
 }
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 
 // Validate required fields
 if (!formData.warehouseId || !formData.costCategory || 
 !formData.costValue || !formData.unitOfMeasure || !formData.effectiveDate) {
 toast.error('Please fill in all required fields')
 return
 }

 // Check for overlapping rates
 const canProceed = await checkForOverlap()
 if (!canProceed) {
 return
 }

 setLoading(true)
 try {
 const response = await fetchWithCSRF('/api/settings/rates', {
 method: 'POST',
 body: JSON.stringify({
 ...formData,
 costValue: parseFloat(formData.costValue),
 effectiveDate: new Date(formData.effectiveDate),
 endDate: formData.endDate ? new Date(formData.endDate) : null
 })
 })

 if (response.ok) {
 toast.success('Rate created successfully')
 router.push('/config/warehouses?view=rates')
 } else {
 const error = await response.json()
 toast.error(error.error || 'Failed to create rate')
 }
 } catch (_error) {
 toast.error('Failed to create rate')
 } finally {
 setLoading(false)
 }
 }

 const handleCancel = () => {
 router.push('/config/warehouses?view=rates')
 }

 const handleCategoryChange = (category: string) => {
  setFormData({
    ...formData,
    costCategory: category,
    unitOfMeasure: ''
  })
}

 return (
 <DashboardLayout>
 <div className="space-y-6">
 <PageHeader
 title="New Cost Rate"
 subtitle="Add a new rate to the system"
 icon={DollarSign}
 iconColor="text-green-600"
 bgColor="bg-green-50"
 borderColor="border-green-200"
 textColor="text-green-800"
 />

 <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
 <div className="grid gap-6 md:grid-cols-2">
 {/* Warehouse */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Warehouse <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.warehouseId}
 onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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

 {/* Category */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Cost Category <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.costCategory}
 onChange={(e) => handleCategoryChange(e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 required
 >
 <option value="">Select category</option>
 {costCategories.map(cat => (
 <option key={cat.value} value={cat.value}>
 {cat.label} - {cat.description}
 </option>
 ))}
 </select>
 <p className="text-xs text-slate-500 mt-1">
 Each cost category can only have one active rate per warehouse.
 </p>
 </div>

 {/* Unit of Measure */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Unit of Measure <span className="text-red-500">*</span>
 </label>
 <select
 value={formData.unitOfMeasure}
 onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 required
 >
 <option value="">Select unit</option>
 {formData.costCategory && unitsByCategory[formData.costCategory]?.map(unit => (
 <option key={unit} value={unit}>
 {unit}
 </option>
 ))}
 </select>
 </div>

 {/* Cost Value */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Rate (£) <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={formData.costValue}
 onChange={(e) => setFormData({ ...formData, costValue: e.target.value })}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="0.00"
 required
 />
 </div>

 {/* Effective Date */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Effective Date <span className="text-red-500">*</span>
 </label>
 <input
 type="date"
 value={formData.effectiveDate}
 onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 required
 />
 </div>

 {/* End Date */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 End Date
 </label>
 <input
 type="date"
 value={formData.endDate}
 onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
 min={formData.effectiveDate}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 />
 <p className="text-xs text-slate-500 mt-1">
 Leave blank for indefinite rates
 </p>
 </div>
 </div>


 {/* Action Buttons */}
 <div className="flex justify-end gap-3 pt-4 border-t">
 <button
 type="button"
 onClick={handleCancel}
 className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
 disabled={loading || checkingOverlap}
 >
 <X className="h-4 w-4 mr-2 inline" />
 Cancel
 </button>
 <button
 type="submit"
 disabled={loading || checkingOverlap}
 className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
 >
 <Save className="h-4 w-4 mr-2 inline" />
 {loading ? 'Creating...' : checkingOverlap ? 'Checking...' : 'Create Rate'}
 </button>
 </div>
 </form>
 </div>
 </DashboardLayout>
 )
}
