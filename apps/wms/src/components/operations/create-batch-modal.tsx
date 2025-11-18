'use client'

import { useEffect, useState } from 'react'
import { X, Save } from '@/lib/lucide-icons'

interface BatchFormData {
  batchCode: string
  description?: string
  productionDate?: string
  expiryDate?: string
}

interface CreateBatchModalProps {
  isOpen: boolean
  skuCode: string
  onClose: () => void
  onSave: (data: BatchFormData) => void
}

export function CreateBatchModal({ isOpen, skuCode, onClose, onSave }: CreateBatchModalProps) {
  const [formData, setFormData] = useState<BatchFormData>({
    batchCode: '',
    description: '',
    productionDate: '',
    expiryDate: ''
  })

  useEffect(() => {
    if (isOpen) {
      setFormData({
        batchCode: '',
        description: '',
        productionDate: '',
        expiryDate: ''
      })
    }
  }, [isOpen, skuCode])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.batchCode.trim()) {
      return
    }
    onSave({
      batchCode: formData.batchCode.trim(),
      description: formData.description?.trim() || undefined,
      productionDate: formData.productionDate || undefined,
      expiryDate: formData.expiryDate || undefined
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">SKU</p>
            <h2 className="text-lg font-semibold text-slate-900">{skuCode}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Batch Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.batchCode}
              onChange={(e) => setFormData({ ...formData, batchCode: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
              placeholder="e.g., LOT-2401"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Optional notes"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Production Date
              </label>
              <input
                type="date"
                value={formData.productionDate}
                onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1"
            >
              <Save className="h-4 w-4" />
              Save Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
