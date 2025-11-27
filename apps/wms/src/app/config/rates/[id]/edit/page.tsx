'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { DollarSign, Save, X, Calendar, AlertCircle } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'
import { redirectToPortal } from '@/lib/portal'

interface CostRate {
 id: string
 warehouseId: string
 warehouse: {
 id: string
 name: string
 code: string
 }
 costCategory: string
 costName: string
 costValue: number
 unitOfMeasure: string
 effectiveDate: string
 endDate?: string
}

const unitsByCategory: { [key: string]: string[] } = {
 Storage: ['per_pallet_day'],
 Container: ['per_container'],
 Carton: ['per_carton'],
 Unit: ['per_sku', 'flat'],
 transportation: ['flat'],
 Accessorial: ['per_shipment', 'per_invoice', 'flat']
}

export default function EditRatePage() {
 const router = useRouter()
 const params = useParams()
 const { data: session, status } = useSession()
 const [loading, setLoading] = useState(true)
 const [saving, setSaving] = useState(false)
 const [rate, setRate] = useState<CostRate | null>(null)
 const [checkingOverlap, setCheckingOverlap] = useState(false)
 
 const [formData, setFormData] = useState({
 costName: '',
 costValue: '',
 unitOfMeasure: '',
 endDate: ''
 })

 useEffect(() => {
 if (status === 'loading') return
 if (!session || session.user.role !== 'admin') {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    redirectToPortal('/login', `${window.location.origin}${basePath}/config/rates/${params.id}/edit`)
 return
 }
 fetchRate()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [session, status, router, params.id])

 const fetchRate = async () => {
 try {
 const response = await fetch(`/api/settings/rates/${params.id}`)
 if (response.ok) {
 const data = await response.json()
 setRate(data)
 setFormData({
 costName: data.costName || '',
 costValue: data.costValue.toString(),
 unitOfMeasure: data.unitOfMeasure,
 endDate: data.endDate ? data.endDate.split('T')[0] : ''
 })
 } else {
 toast.error('Rate not found')
 router.push('/config/warehouses?view=rates')
 }
 } catch (_error) {
 toast.error('Failed to load rate')
 router.push('/config/warehouses?view=rates')
 } finally {
 setLoading(false)
 }
 }

 const checkForOverlap = async () => {
  if (!rate || !formData.costName) return true

 setCheckingOverlap(true)
 try {
 const response = await fetch('/api/settings/rates/check-overlap', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 rateId: rate.id,
 warehouseId: rate.warehouseId,
 costName: formData.costName,
 effectiveDate: rate.effectiveDate
 })
 })

 if (response.ok) {
 const { hasOverlap, message } = await response.json()
 if (hasOverlap) {
 toast.error(message || 'This change would create overlapping rates')
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
 
 if (!formData.costValue || !formData.unitOfMeasure || !formData.costName) {
 toast.error('Please fill in all required fields')
 return
 }

 // Check for overlapping rates
 const canProceed = await checkForOverlap()
 if (!canProceed) {
 return
 }

 setSaving(true)
 try {
 const response = await fetch(`/api/settings/rates/${params.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      costName: formData.costName,
      costValue: parseFloat(formData.costValue),
      unitOfMeasure: formData.unitOfMeasure,
      endDate: formData.endDate || null
 })
 })

 if (response.ok) {
 toast.success('Rate updated successfully')
 router.push('/config/warehouses?view=rates')
 } else {
 const error = await response.json()
 toast.error(error.error || 'Failed to update rate')
 }
 } catch (_error) {
 toast.error('Failed to update rate')
 } finally {
 setSaving(false)
 }
 }

 const handleCancel = () => {
 router.push('/config/warehouses?view=rates')
 }

 if (loading || !rate) {
 return (
 <DashboardLayout>
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
 </div>
 </DashboardLayout>
 )
 }

 return (
 <DashboardLayout>
 <div className="space-y-6">
 <PageHeader
 title="Edit Cost Rate"
 subtitle={`${rate.warehouse.name} - ${rate.costName}`}
 icon={DollarSign}
 iconColor="text-green-600"
 bgColor="bg-green-50"
 borderColor="border-green-200"
 textColor="text-green-800"
 />

 <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
 {/* Read-only Information */}
 <div className="bg-slate-50 rounded-lg p-4 space-y-3">
 <h3 className="font-semibold text-slate-900">Rate Details</h3>
 <div className="grid gap-4 md:grid-cols-3 text-sm">
 <div>
 <span className="text-slate-600">Warehouse:</span>
 <p className="font-medium">{rate.warehouse.name} ({rate.warehouse.code})</p>
 </div>
 <div>
 <span className="text-slate-600">Rate Name:</span>
 <p className="font-medium">{rate.costName}</p>
 </div>
 <div>
 <span className="text-slate-600">Category:</span>
 <p className="font-medium">{rate.costCategory}</p>
 </div>
 <div>
 <span className="text-slate-600">Effective Date:</span>
 <p className="font-medium flex items-center gap-1">
 <Calendar className="h-4 w-4" />
 {new Date(rate.effectiveDate).toLocaleDateString()}
 </p>
 </div>
 </div>
 </div>

 <div className="grid gap-6 md:grid-cols-2">
 {/* Rate Name */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Rate Name <span className="text-red-500">*</span>
 </label>
 <input
 value={formData.costName}
 onChange={(e) => setFormData({ ...formData, costName: e.target.value })}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 required
 />
 <p className="text-xs text-slate-500 mt-1">Update the display label for this rate.</p>
 </div>

 {/* Unit of Measure */}
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Unit of Measure <span className="text-red-500">*</span>
 </label>
 {(() => {
   const baseUnits = unitsByCategory[rate.costCategory] ?? []
   const currentUnit = formData.unitOfMeasure ? [formData.unitOfMeasure] : []
   const unitOptions = Array.from(new Set([...baseUnits, ...currentUnit].filter(Boolean)))
   return (
     <>
       <select
         value={formData.unitOfMeasure}
         onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
         className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
         required
       >
         <option value="">Select unit</option>
         {unitOptions.map(unit => (
           <option key={unit} value={unit}>
             {unit}
           </option>
         ))}
       </select>
       <p className="text-xs text-slate-500 mt-1">
         Pick the unit that matches how this rate is applied (e.g., per_pallet_day, per_container, per_shipment).
       </p>
     </>
   )
 })()}
 </div>

 {/* Cost Value */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Rate (£ / $) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
            £ / $
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.costValue}
            onChange={(e) => setFormData({ ...formData, costValue: e.target.value })}
            className="w-full pl-16 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">Enter the value in GBP or USD as needed.</p>
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
 min={rate.effectiveDate.split('T')[0]}
 className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 />
 <p className="text-xs text-slate-500 mt-1">
 Set an end date to expire this rate
 </p>
 </div>
 </div>


 {/* Warning for date changes */}
 {formData.endDate && (
 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
 <div className="flex items-start gap-3">
 <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
 <div className="text-sm text-yellow-800">
 <p className="font-semibold">End Date Warning</p>
 <p>Setting an end date will expire this rate after {new Date(formData.endDate).toLocaleDateString()}. 
 Make sure another rate is configured to take effect after this date to avoid gaps in pricing.</p>
 </div>
 </div>
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex justify-end gap-3 pt-4 border-t">
 <button
 type="button"
 onClick={handleCancel}
 className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
 disabled={saving || checkingOverlap}
 >
 <X className="h-4 w-4 mr-2 inline" />
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving || checkingOverlap}
 className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
 >
 <Save className="h-4 w-4 mr-2 inline" />
 {saving ? 'Updating...' : checkingOverlap ? 'Checking...' : 'Update Rate'}
 </button>
 </div>
 </form>
 </div>
 </DashboardLayout>
 )
}
