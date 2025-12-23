'use client'

import { useState } from 'react'
import { X, Save } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'

const MATERIAL_OPTIONS = ['Plastic', 'Cotton'] as const
const PACKAGING_OPTIONS = ['Box', 'Polybag'] as const

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

interface CreateSkuBatchModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SkuBatchData) => void
  initialSkuCode?: string
  initialBatchCode?: string
}

export function CreateSkuBatchModal({
  isOpen,
  onClose,
  onSave,
  initialSkuCode = '',
  initialBatchCode = ''
}: CreateSkuBatchModalProps) {
  const [formData, setFormData] = useState<SkuBatchData>({
    skuCode: initialSkuCode,
    description: '',
    packSize: 1,
    unitsPerCarton: 1,
    batchCode: initialBatchCode,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.skuCode || !formData.description || !formData.batchCode) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.packSize < 1 || formData.unitsPerCarton < 1) {
      toast.error('Pack size and units per carton must be at least 1')
      return
    }

    onSave(formData)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Create New SKU + Batch</h2>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="sku-batch-form" onSubmit={handleSubmit} className="space-y-6">
            {/* SKU Master Data Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">
                SKU Master Data
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    SKU Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.skuCode}
                    onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., SKU-12345"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ASIN
                  </label>
                  <input
                    type="text"
                    value={formData.asin || ''}
                    onChange={(e) => setFormData({ ...formData, asin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., B08XYZ1234"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Product description"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pack Size <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.packSize}
                    onChange={(e) => setFormData({ ...formData, packSize: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Units per Carton <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.unitsPerCarton}
                    onChange={(e) => setFormData({ ...formData, unitsPerCarton: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Material
                  </label>
                  <select
                    value={formData.material || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        material: e.target.value || undefined
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Select material</option>
                    {MATERIAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Packaging Type
                  </label>
                  <select
                    value={formData.packagingType || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        packagingType: e.target.value || undefined
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Select packaging</option>
                    {PACKAGING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit Dimensions (cm)
                  </label>
                  <input
                    type="text"
                    value={formData.unitDimensionsCm || ''}
                    onChange={(e) => setFormData({ ...formData, unitDimensionsCm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="L x W x H (e.g., 10 x 5 x 3)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.unitWeightKg || ''}
                    onChange={(e) => setFormData({ ...formData, unitWeightKg: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Carton Dimensions (cm)
                  </label>
                  <input
                    type="text"
                    value={formData.cartonDimensionsCm || ''}
                    onChange={(e) => setFormData({ ...formData, cartonDimensionsCm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="L x W x H (e.g., 40 x 30 x 20)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Carton Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.cartonWeightKg || ''}
                    onChange={(e) => setFormData({ ...formData, cartonWeightKg: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.000"
                  />
                </div>
              </div>
            </div>

            {/* Batch Data Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b">
                Batch Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batch Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.batchCode}
                    onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., BATCH-2025-01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batch Description
                  </label>
                  <input
                    type="text"
                    value={formData.batchDescription || ''}
                    onChange={(e) => setFormData({ ...formData, batchDescription: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., January 2025 Production"
                  />
                </div>

              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4 mr-2 inline" />
            Cancel
          </button>
          <button
            type="submit"
            form="sku-batch-form"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <Save className="h-4 w-4 mr-2 inline" />
            Create SKU + Batch
          </button>
        </div>
      </div>
    </div>
  )
}
