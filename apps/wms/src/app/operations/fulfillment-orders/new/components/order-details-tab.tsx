'use client'

import { Input } from '@/components/ui/input'
import type { FormData, WarehouseOption } from './types'
import { DESTINATION_TYPES } from './types'

interface OrderDetailsTabProps {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  warehouses: WarehouseOption[]
  loading: boolean
}

export function OrderDetailsTab({
  formData,
  setFormData,
  warehouses,
  loading,
}: OrderDetailsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1.5">Warehouse *</label>
          <select
            value={formData.warehouseCode}
            onChange={e => setFormData(prev => ({ ...prev, warehouseCode: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            disabled={loading}
            required
          >
            <option value="">Select warehouse</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.code}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Destination Type</label>
          <select
            value={formData.destinationType}
            onChange={e => setFormData(prev => ({ ...prev, destinationType: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          >
            {DESTINATION_TYPES.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Destination Name</label>
          <Input
            value={formData.destinationName}
            onChange={e => setFormData(prev => ({ ...prev, destinationName: e.target.value }))}
            placeholder="Customer / FBA / Warehouse name"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Destination Country</label>
          <Input
            value={formData.destinationCountry}
            onChange={e => setFormData(prev => ({ ...prev, destinationCountry: e.target.value }))}
            placeholder="US, UK, ..."
            className="text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Destination Address</label>
          <Input
            value={formData.destinationAddress}
            onChange={e => setFormData(prev => ({ ...prev, destinationAddress: e.target.value }))}
            placeholder="Optional address..."
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Shipping Carrier</label>
          <Input
            value={formData.shippingCarrier}
            onChange={e => setFormData(prev => ({ ...prev, shippingCarrier: e.target.value }))}
            placeholder="Optional..."
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
          <Input
            value={formData.trackingNumber}
            onChange={e => setFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
            placeholder="Optional..."
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Shipping Method</label>
          <Input
            value={formData.shippingMethod}
            onChange={e => setFormData(prev => ({ ...prev, shippingMethod: e.target.value }))}
            placeholder="Optional..."
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">External Reference</label>
          <Input
            value={formData.externalReference}
            onChange={e => setFormData(prev => ({ ...prev, externalReference: e.target.value }))}
            placeholder="Amazon shipment ID, etc."
            className="text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Notes</label>
          <Input
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes..."
            className="text-sm"
          />
        </div>
      </div>
    </div>
  )
}
