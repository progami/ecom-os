'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Plus, Trash2 } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

interface Sku {
  id: string
  skuCode: string
  description: string
}

interface LineItem {
  id: string
  skuCode: string
  skuDescription: string
  quantity: number
  unitCost: string
  currency: string
  notes: string
}

const CURRENCIES = ['USD', 'GBP', 'EUR']

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [skus, setSkus] = useState<Sku[]>([])
  const [formData, setFormData] = useState({
    counterpartyName: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/orders/new`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }

    const loadSkus = async () => {
      try {
        const response = await fetch('/api/skus')
        if (response.ok) {
          const data = await response.json()
          setSkus(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Failed to load SKUs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSkus()
  }, [router, session, status])

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: generateTempId(),
        skuCode: '',
        skuDescription: '',
        quantity: 1,
        unitCost: '',
        currency: 'USD',
        notes: '',
      },
    ])
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item

        // If SKU is selected, auto-fill description
        if (field === 'skuCode') {
          const selectedSku = skus.find((s) => s.skuCode === value)
          return {
            ...item,
            skuCode: value as string,
            skuDescription: selectedSku?.description || '',
          }
        }

        return { ...item, [field]: value }
      })
    )
  }

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    const invalidLines = lineItems.filter((item) => !item.skuCode || item.quantity <= 0)
    if (invalidLines.length > 0) {
      toast.error('Please fill in SKU and quantity for all line items')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchWithCSRF('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyName: formData.counterpartyName || undefined,
          notes: formData.notes || undefined,
          lines: lineItems.map((item) => ({
            skuCode: item.skuCode,
            skuDescription: item.skuDescription,
            quantity: item.quantity,
            unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
            currency: item.currency,
            notes: item.notes || undefined,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Failed to create purchase order')
      }

      const data = await response.json()
      toast.success('Purchase order created')
      router.push(`/operations/orders/${data.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <Link
            href="/operations/orders"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Orders
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">Order Details</h2>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Supplier / Counterparty <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.counterpartyName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, counterpartyName: e.target.value }))}
                  placeholder="Enter supplier name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <p className="mb-2">No line items added</p>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground border-b pb-2">
                  <div className="col-span-3">SKU</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2">Unit Cost</div>
                  <div className="col-span-2">Notes</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Line Items */}
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-3">
                      <select
                        value={item.skuCode}
                        onChange={(e) => updateLineItem(item.id, 'skuCode', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        required
                      >
                        <option value="">Select SKU</option>
                        {skus.map((sku) => (
                          <option key={sku.id} value={sku.skuCode}>
                            {sku.skuCode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={item.skuDescription}
                        onChange={(e) => updateLineItem(item.id, 'skuDescription', e.target.value)}
                        placeholder="Description"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="text-sm"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateLineItem(item.id, 'unitCost', e.target.value)}
                          placeholder="0.00"
                          className="text-sm flex-1"
                        />
                        <select
                          value={item.currency}
                          onChange={(e) => updateLineItem(item.id, 'currency', e.target.value)}
                          className="w-16 px-1 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                        >
                          {CURRENCIES.map((curr) => (
                            <option key={curr} value={curr}>
                              {curr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.notes}
                        onChange={(e) => updateLineItem(item.id, 'notes', e.target.value)}
                        placeholder="Notes"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/operations/orders')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || lineItems.length === 0}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
