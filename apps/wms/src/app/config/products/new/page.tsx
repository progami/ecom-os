'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Plus, Trash2 } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Batch {
 batchCode: string
 description: string
 productionDate: string
 expiryDate: string
}

export default function NewSkuPage() {
 const router = useRouter()
 const [loading, setLoading] = useState(false)
 const [formData, setFormData] = useState({
 skuCode: '',
 asin: '',
 description: '',
 packSize: 1,
 material: '',
 unitDimensionsCm: '',
 unitWeightKg: '',
 unitsPerCarton: 1,
 cartonDimensionsCm: '',
 cartonWeightKg: '',
 packagingType: '',
 isActive: true
 })

 // Separate state for dimension inputs
 const [unitDimensions, setUnitDimensions] = useState({ length: '', width: '', height: '' })
 const [cartonDimensions, setCartonDimensions] = useState({ length: '', width: '', height: '' })
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [batches, setBatches] = useState<Batch[]>([{ batchCode: '', description: '', productionDate: '', expiryDate: '' }])

 const addBatch = () => {
 setBatches([...batches, { batchCode: '', description: '', productionDate: '', expiryDate: '' }])
 }

 const removeBatch = (index: number) => {
 if (batches.length > 1) {
 setBatches(batches.filter((_, i) => i !== index))
 }
 }

 const updateBatch = (index: number, field: keyof Batch, value: string) => {
 const newBatches = [...batches]
 newBatches[index][field] = value
 setBatches(newBatches)
 }

 const validateForm = () => {
 const newErrors: Record<string, string> = {}

 if (!formData.skuCode.trim()) {
 newErrors.skuCode = 'SKU code is required'
 } else if (formData.skuCode.length > 50) {
 newErrors.skuCode = 'SKU code must be 50 characters or less'
 }

 if (!formData.description.trim()) {
 newErrors.description = 'Description is required'
 }

 if (formData.packSize < 1) {
 newErrors.packSize = 'Pack size must be at least 1'
 }

 if (formData.unitsPerCarton < 1) {
 newErrors.unitsPerCarton = 'Units per carton must be at least 1'
 }

 if (formData.unitWeightKg && parseFloat(formData.unitWeightKg) <= 0) {
 newErrors.unitWeightKg = 'Weight must be positive'
 }

 if (formData.cartonWeightKg && parseFloat(formData.cartonWeightKg) <= 0) {
 newErrors.cartonWeightKg = 'Weight must be positive'
 }

 // Validate batches - at least one batch with a batch code is required
 const validBatches = batches.filter(b => b.batchCode.trim())
 if (validBatches.length === 0) {
 newErrors.batches = 'At least one batch with a batch code is required'
 }

 // Check for duplicate batch codes
 const batchCodes = validBatches.map(b => b.batchCode.trim().toUpperCase())
 const duplicates = batchCodes.filter((code, index) => batchCodes.indexOf(code) !== index)
 if (duplicates.length > 0) {
 newErrors.batches = 'Duplicate batch codes are not allowed'
 }

 setErrors(newErrors)
 return Object.keys(newErrors).length === 0
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()

 if (!validateForm()) return

 setLoading(true)
 try {
 // Format dimensions back to string
 const formatDimensions = (dims: { length: string, width: string, height: string }) => {
 if (!dims.length && !dims.width && !dims.height) return undefined
 return `${dims.length || 0}x${dims.width || 0}x${dims.height || 0}`
 }

 const submitData = {
 ...formData,
 skuCode: formData.skuCode.toUpperCase(),
 packSize: parseInt(formData.packSize.toString()),
 unitsPerCarton: parseInt(formData.unitsPerCarton.toString()),
 unitWeightKg: formData.unitWeightKg ? parseFloat(formData.unitWeightKg) : undefined,
 cartonWeightKg: formData.cartonWeightKg ? parseFloat(formData.cartonWeightKg) : undefined,
 asin: formData.asin || undefined,
 material: formData.material || undefined,
 unitDimensionsCm: formatDimensions(unitDimensions),
 cartonDimensionsCm: formatDimensions(cartonDimensions),
 packagingType: formData.packagingType || undefined
 }

 // Create SKU
 const response = await fetch('/api/skus', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(submitData)
 })

 if (!response.ok) {
 const error = await response.json()
 throw new Error(error.error || 'Failed to create SKU')
 }

 const createdSku = await response.json()
 const skuId = createdSku.id

 // Create batches
 const validBatches = batches.filter(b => b.batchCode.trim())
 for (const batch of validBatches) {
 const batchResponse = await fetch(`/api/skus/${skuId}/batches`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 batchCode: batch.batchCode.toUpperCase(),
 description: batch.description || undefined,
 productionDate: batch.productionDate || undefined,
 expiryDate: batch.expiryDate || undefined
 })
 })

 if (!batchResponse.ok) {
 const error = await batchResponse.json().catch(() => ({}))
 throw new Error(error.error || `Failed to create batch ${batch.batchCode}`)
 }
 }

 alert('SKU and batches created successfully!')
 router.push('/config/products')
 } catch (error: unknown) {
 // console.error('Error creating SKU:', error)
 alert(error instanceof Error ? error.message : 'Failed to create SKU')
 } finally {
 setLoading(false)
 }
 }

 return (
 <DashboardLayout>
 <div className="max-w-4xl mx-auto space-y-6">
 <div className="flex items-center gap-4">
 <Button asChild variant="ghost" size="icon">
 <Link href="/config/products">
 <ArrowLeft className="h-5 w-5" />
 </Link>
 </Button>
 <div>
 <h1 className="text-3xl font-bold">Create New SKU</h1>
 <p className="text-muted-foreground">
 Add a new product SKU to the system
 </p>
 </div>
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 {/* Basic Information */}
 <div className="bg-white border rounded-lg p-6">
 <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 SKU Code *
 </label>
 <input
 type="text"
 value={formData.skuCode}
 onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.skuCode ? 'border-red-500' : ''
 }`}
 placeholder="e.g., PROD-001"
 maxLength={50}
 />
 {errors.skuCode && (
 <p className="text-red-500 text-sm mt-1">{errors.skuCode}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 ASIN
 </label>
 <input
 type="text"
 value={formData.asin}
 onChange={(e) => setFormData({ ...formData, asin: e.target.value })}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Amazon ASIN"
 />
 </div>

 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Description *
 </label>
 <input
 type="text"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.description ? 'border-red-500' : ''
 }`}
 placeholder="Product description"
 />
 {errors.description && (
 <p className="text-red-500 text-sm mt-1">{errors.description}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Pack Size *
 </label>
 <input
 type="number"
 min="1"
 value={formData.packSize}
 onChange={(e) => setFormData({ ...formData, packSize: parseInt(e.target.value) || 1 })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.packSize ? 'border-red-500' : ''
 }`}
 />
 {errors.packSize && (
 <p className="text-red-500 text-sm mt-1">{errors.packSize}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Material
 </label>
 <input
 type="text"
 value={formData.material}
 onChange={(e) => setFormData({ ...formData, material: e.target.value })}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="e.g., Plastic, Metal, Wood"
 />
 </div>
 </div>
 </div>

 {/* Unit Specifications */}
 <div className="bg-white border rounded-lg p-6">
 <h2 className="text-lg font-semibold mb-4">Unit Specifications</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Unit Dimensions (cm)
 </label>
 <div className="grid grid-cols-3 gap-2">
 <input
 type="number"
 step="0.1"
 min="0"
 value={unitDimensions.length}
 onChange={(e) => setUnitDimensions({ ...unitDimensions, length: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Length"
 />
 <input
 type="number"
 step="0.1"
 min="0"
 value={unitDimensions.width}
 onChange={(e) => setUnitDimensions({ ...unitDimensions, width: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Width"
 />
 <input
 type="number"
 step="0.1"
 min="0"
 value={unitDimensions.height}
 onChange={(e) => setUnitDimensions({ ...unitDimensions, height: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Height"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Unit Weight (kg)
 </label>
 <input
 type="number"
 step="0.001"
 min="0"
 value={formData.unitWeightKg}
 onChange={(e) => setFormData({ ...formData, unitWeightKg: e.target.value })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.unitWeightKg ? 'border-red-500' : ''
 }`}
 />
 {errors.unitWeightKg && (
 <p className="text-red-500 text-sm mt-1">{errors.unitWeightKg}</p>
 )}
 </div>
 </div>
 </div>

 {/* Carton Specifications */}
 <div className="bg-white border rounded-lg p-6">
 <h2 className="text-lg font-semibold mb-4">Carton Specifications</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Units per Carton *
 </label>
 <input
 type="number"
 min="1"
 value={formData.unitsPerCarton}
 onChange={(e) => setFormData({ ...formData, unitsPerCarton: parseInt(e.target.value) || 1 })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.unitsPerCarton ? 'border-red-500' : ''
 }`}
 />
 {errors.unitsPerCarton && (
 <p className="text-red-500 text-sm mt-1">{errors.unitsPerCarton}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Packaging Type
 </label>
 <input
 type="text"
 value={formData.packagingType}
 onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="e.g., Box, Bag, Pallet"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Carton Dimensions (cm)
 </label>
 <div className="grid grid-cols-3 gap-2">
 <input
 type="number"
 step="0.1"
 min="0"
 value={cartonDimensions.length}
 onChange={(e) => setCartonDimensions({ ...cartonDimensions, length: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Length"
 />
 <input
 type="number"
 step="0.1"
 min="0"
 value={cartonDimensions.width}
 onChange={(e) => setCartonDimensions({ ...cartonDimensions, width: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Width"
 />
 <input
 type="number"
 step="0.1"
 min="0"
 value={cartonDimensions.height}
 onChange={(e) => setCartonDimensions({ ...cartonDimensions, height: e.target.value })}
 className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Height"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Carton Weight (kg)
 </label>
 <input
 type="number"
 step="0.001"
 min="0"
 value={formData.cartonWeightKg}
 onChange={(e) => setFormData({ ...formData, cartonWeightKg: e.target.value })}
 className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
 errors.cartonWeightKg ? 'border-red-500' : ''
 }`}
 />
 {errors.cartonWeightKg && (
 <p className="text-red-500 text-sm mt-1">{errors.cartonWeightKg}</p>
 )}
 </div>
 </div>
 </div>

 {/* Additional Information */}
 <div className="bg-white border rounded-lg p-6">
 <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
 <div className="space-y-4">

 <div className="flex items-center">
 <input
 type="checkbox"
 id="isActive"
 checked={formData.isActive}
 onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
 className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
 />
 <label htmlFor="isActive" className="ml-2 text-sm text-slate-700">
 Active SKU (available for transactions)
 </label>
 </div>
 </div>
 </div>

 {/* Product Batches */}
 <div className="bg-white border rounded-lg p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-lg font-semibold">Product Batches *</h2>
 <p className="text-sm text-slate-500">
 Define batch codes for inventory tracking. At least one batch is required.
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 onClick={addBatch}
 className="gap-2"
 >
 <Plus className="h-4 w-4" />
 Add Batch
 </Button>
 </div>

 {errors.batches && (
 <p className="text-red-500 text-sm mb-4">{errors.batches}</p>
 )}

 <div className="space-y-4">
 {batches.map((batch, index) => (
 <div key={index} className="border rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium text-slate-700">Batch {index + 1}</h3>
 {batches.length > 1 && (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => removeBatch(index)}
 className="text-red-600 hover:text-red-700 hover:bg-red-50"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Batch Code *
 </label>
 <input
 type="text"
 value={batch.batchCode}
 onChange={(e) => updateBatch(index, 'batchCode', e.target.value)}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="e.g., LOT-2025-01"
 maxLength={64}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Description
 </label>
 <input
 type="text"
 value={batch.description}
 onChange={(e) => updateBatch(index, 'description', e.target.value)}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 placeholder="Optional description"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Production Date
 </label>
 <input
 type="date"
 value={batch.productionDate}
 onChange={(e) => updateBatch(index, 'productionDate', e.target.value)}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">
 Expiry Date
 </label>
 <input
 type="date"
 value={batch.expiryDate}
 onChange={(e) => updateBatch(index, 'expiryDate', e.target.value)}
 className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end gap-4">
 <Button asChild variant="ghost">
 <Link href="/config/products">Cancel</Link>
 </Button>
 <Button type="submit" disabled={loading} className="gap-2">
 {loading ? (
 <>
 <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
 Creating...
 </>
 ) : (
 <>
 <Save className="h-4 w-4" />
 Create SKU
 </>
 )}
 </Button>
 </div>
 </form>
 </div>
 </DashboardLayout>
 )
}
