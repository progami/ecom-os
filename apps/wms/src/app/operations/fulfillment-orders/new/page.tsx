'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ArrowLeft, FileText } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

type WarehouseOption = {
  id: string
  code: string
  name: string
  kind?: string
}

type SkuBatchOption = {
  id: string
  batchCode: string
}

type SkuOption = {
  id: string
  skuCode: string
  description: string
  batches: SkuBatchOption[]
}

type LineItem = {
  id: string
  skuCode: string
  skuDescription: string
  batchLot: string
  quantity: number
  notes: string
}

const DESTINATION_TYPES = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'AMAZON_FBA', label: 'Amazon FBA' },
  { value: 'TRANSFER', label: 'Transfer' },
] as const

export default function NewFulfillmentOrderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [skus, setSkus] = useState<SkuOption[]>([])

  const [formData, setFormData] = useState({
    warehouseCode: '',
    destinationType: 'CUSTOMER',
    destinationName: '',
    destinationAddress: '',
    destinationCountry: '',
    shippingCarrier: '',
    shippingMethod: '',
    trackingNumber: '',
    externalReference: '',
    notes: '',
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      skuCode: '',
      skuDescription: '',
      batchLot: '',
      quantity: 1,
      notes: '',
    },
  ])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/fulfillment-orders/new`)
      return
    }
  }, [session, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const load = async () => {
      try {
        setLoading(true)
        const [warehousesRes, skusRes] = await Promise.all([
          fetch('/api/warehouses?includeAmazon=true'),
          fetch('/api/skus'),
        ])

        if (!warehousesRes.ok) {
          const payload = await warehousesRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load warehouses')
        }
        if (!skusRes.ok) {
          const payload = await skusRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load SKUs')
        }

        const warehousesPayload = await warehousesRes.json().catch(() => null)
        const skusPayload = await skusRes.json().catch(() => null)

        const warehousesData = Array.isArray(warehousesPayload?.data)
          ? (warehousesPayload.data as WarehouseOption[])
          : Array.isArray(warehousesPayload)
            ? (warehousesPayload as WarehouseOption[])
            : []
        const skusData = Array.isArray(skusPayload?.data)
          ? (skusPayload.data as SkuOption[])
          : Array.isArray(skusPayload)
            ? (skusPayload as SkuOption[])
            : []

        setWarehouses(warehousesData)
        setSkus(skusData)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status])

  const warehouseLabel = useMemo(() => {
    const selected = warehouses.find(w => w.code === formData.warehouseCode)
    return selected ? `${selected.code} — ${selected.name}` : ''
  }, [formData.warehouseCode, warehouses])

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        skuCode: '',
        skuDescription: '',
        batchLot: '',
        quantity: 1,
        notes: '',
      },
    ])
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: unknown) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item

        if (field === 'skuCode') {
          const nextSkuCode = String(value)
          const sku = skus.find(s => s.skuCode === nextSkuCode)
          return {
            ...item,
            skuCode: nextSkuCode,
            skuDescription: sku?.description ?? item.skuDescription,
            batchLot: '',
          }
        }

        return {
          ...item,
          [field]: value,
        } as LineItem
      })
    )
  }

  const getBatchOptions = (skuCode: string) => {
    const sku = skus.find(s => s.skuCode === skuCode)
    return sku?.batches ?? []
  }

  const handleSubmit = async () => {
    try {
      if (!formData.warehouseCode) {
        toast.error('Select a warehouse')
        return
      }

      const invalidLine = lineItems.find(item => !item.skuCode || !item.batchLot || item.quantity <= 0)
      if (invalidLine) {
        toast.error('Each line requires SKU, batch/lot, and quantity')
        return
      }

      setSubmitting(true)

      const payload = {
        warehouseCode: formData.warehouseCode,
        warehouseName: warehouseLabel || undefined,
        destinationType: formData.destinationType,
        destinationName: formData.destinationName || undefined,
        destinationAddress: formData.destinationAddress || undefined,
        destinationCountry: formData.destinationCountry || undefined,
        shippingCarrier: formData.shippingCarrier || undefined,
        shippingMethod: formData.shippingMethod || undefined,
        trackingNumber: formData.trackingNumber || undefined,
        externalReference: formData.externalReference || undefined,
        notes: formData.notes || undefined,
        lines: lineItems.map(item => ({
          skuCode: item.skuCode,
          skuDescription: item.skuDescription || undefined,
          batchLot: item.batchLot,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      }

      const response = await fetchWithCSRF('/api/fulfillment-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to create fulfillment order')
        return
      }

      const orderId = data?.data?.id
      if (!orderId) {
        toast.error('Fulfillment order created but missing ID in response')
        return
      }

      toast.success('Fulfillment order created')
      router.push(`/operations/fulfillment-orders/${orderId}`)
    } catch (_error) {
      toast.error('Failed to create fulfillment order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="New Fulfillment Order"
          description="Operations"
          icon={FileText}
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link href="/operations/fulfillment-orders">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border bg-white shadow-soft">
              <div className="px-6 py-4 border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Order Details</h2>
                  <Badge className="bg-slate-100 text-slate-700 border border-slate-200">Draft</Badge>
                </div>
              </div>

              <div className="px-6 py-4 space-y-6">
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

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Line Items</h2>
                    <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-14 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                      <div className="col-span-3">SKU</div>
                      <div className="col-span-3">Batch/Lot</div>
                      <div className="col-span-4">Description</div>
                      <div className="col-span-1">Qty</div>
                      <div className="col-span-2">Notes</div>
                      <div className="col-span-1"></div>
                    </div>

                    {lineItems.map(item => {
                      const batches = getBatchOptions(item.skuCode)
                      return (
                        <div key={item.id} className="grid grid-cols-14 gap-2 items-center">
                          <div className="col-span-3">
                            <select
                              value={item.skuCode}
                              onChange={e => updateLineItem(item.id, 'skuCode', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            >
                              <option value="">Select SKU</option>
                              {skus.map(sku => (
                                <option key={sku.id} value={sku.skuCode}>
                                  {sku.skuCode}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-3">
                            <select
                              value={item.batchLot}
                              onChange={e => updateLineItem(item.id, 'batchLot', e.target.value)}
                              className="w-full px-2 py-1.5 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                              disabled={!item.skuCode}
                            >
                              <option value="">Select batch</option>
                              {batches.map(batch => (
                                <option key={batch.id} value={batch.batchCode}>
                                  {batch.batchCode}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-4">
                            <Input
                              value={item.skuDescription}
                              onChange={e => updateLineItem(item.id, 'skuDescription', e.target.value)}
                              placeholder="Description"
                              className="text-sm h-8"
                            />
                          </div>

                          <div className="col-span-1">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e =>
                                updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                              }
                              className="text-sm h-8"
                              required
                            />
                          </div>

                          <div className="col-span-2">
                            <Input
                              value={item.notes}
                              onChange={e => updateLineItem(item.id, 'notes', e.target.value)}
                              placeholder="Notes"
                              className="text-sm h-8"
                            />
                          </div>

                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => router.push('/operations/fulfillment-orders')}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Creating…' : 'Create Fulfillment Order'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
