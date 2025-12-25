'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Plus, Trash2 } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

interface Supplier {
  id: string
  name: string
  contactName: string | null
  isActive: boolean
}

interface Sku {
  id: string
  skuCode: string
  description: string
}

interface LineItem {
  id: string
  skuId?: string
  skuCode: string
  skuDescription: string
  batchLot: string
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
  const [tenantCurrency, setTenantCurrency] = useState<string>('USD')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  const [batchesBySkuId, setBatchesBySkuId] = useState<Record<string, string[]>>({})
  const [batchesLoadingBySkuId, setBatchesLoadingBySkuId] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    supplierId: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: generateTempId(),
      skuId: undefined,
      skuCode: '',
      skuDescription: '',
      batchLot: 'DEFAULT',
      quantity: 1,
      unitCost: '',
      currency: 'USD',
      notes: '',
    },
  ])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/purchase-orders/new`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }

    const loadData = async () => {
      try {
        const [tenantRes, suppliersRes, skusRes] = await Promise.all([
          fetch('/api/tenant/current'),
          fetch('/api/suppliers'),
          fetch('/api/skus'),
        ])

        if (tenantRes.ok) {
          const tenantData = await tenantRes.json().catch(() => null)
          const currency = tenantData?.current?.currency
          if (typeof currency === 'string' && currency.trim()) {
            const normalized = currency.trim().toUpperCase()
            setTenantCurrency(normalized)
            setLineItems(prev =>
              prev.every(item => item.currency === 'USD')
                ? prev.map(item => ({ ...item, currency: normalized }))
                : prev
            )
          }
        }

        if (suppliersRes.ok) {
          const suppliersData = await suppliersRes.json()
          const suppliersList = suppliersData?.data || suppliersData || []
          setSuppliers(
            Array.isArray(suppliersList) ? suppliersList.filter((s: Supplier) => s.isActive) : []
          )
        }

        if (skusRes.ok) {
          const skusData = await skusRes.json()
          setSkus(Array.isArray(skusData) ? skusData : [])
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, session, status])

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: generateTempId(),
        skuId: undefined,
        skuCode: '',
        skuDescription: '',
        batchLot: 'DEFAULT',
        quantity: 1,
        unitCost: '',
        currency: tenantCurrency,
        notes: '',
      },
    ])
  }

  const ensureSkuBatchesLoaded = async (skuId: string) => {
    if (!skuId) return
    if (batchesBySkuId[skuId]) return
    if (batchesLoadingBySkuId[skuId]) return

    setBatchesLoadingBySkuId(prev => ({ ...prev, [skuId]: true }))
    try {
      const response = await fetch(`/api/skus/${encodeURIComponent(skuId)}/batches`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load batches')
      }

      const payload = await response.json().catch(() => null)
      const batches = Array.isArray(payload?.batches) ? payload.batches : []
      const batchCodes: string[] = batches
        .map((batch: { batchCode?: unknown }) => String(batch?.batchCode ?? '').trim().toUpperCase())
        .filter((batchCode): batchCode is string => Boolean(batchCode))

      const unique: string[] = Array.from(new Set(batchCodes))
      if (!unique.includes('DEFAULT')) {
        unique.unshift('DEFAULT')
      }

      setBatchesBySkuId(prev => ({ ...prev, [skuId]: unique }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load batches')
      setBatchesBySkuId(prev => ({ ...prev, [skuId]: ['DEFAULT'] }))
    } finally {
      setBatchesLoadingBySkuId(prev => ({ ...prev, [skuId]: false }))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    if (field === 'skuCode') {
      const skuCode = String(value)
      const selectedSku = skus.find(s => s.skuCode === skuCode)
      if (!selectedSku) {
        setLineItems(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  skuId: undefined,
                  skuCode: '',
                  skuDescription: '',
                  batchLot: 'DEFAULT',
                }
              : item
          )
        )
        return
      }

      setLineItems(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                skuId: selectedSku.id,
                skuCode: selectedSku.skuCode,
                skuDescription: selectedSku.description || '',
                batchLot: 'DEFAULT',
              }
            : item
        )
      )
      void ensureSkuBatchesLoaded(selectedSku.id)
      return
    }

    setLineItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    const invalidLines = lineItems.filter(item => !item.skuCode || !item.batchLot || item.quantity <= 0)
    if (invalidLines.length > 0) {
      toast.error('Please fill in SKU, batch/lot, and quantity for all line items')
      return
    }

    const selectedSupplier = suppliers.find(s => s.id === formData.supplierId)
    if (!selectedSupplier) {
      toast.error('Invalid supplier selected')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchWithCSRF('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyName: selectedSupplier.name,
          notes: formData.notes || undefined,
          lines: lineItems.map(item => ({
            skuCode: item.skuCode,
            skuDescription: item.skuDescription,
            batchLot: item.batchLot.trim().toUpperCase(),
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
      router.push(`/operations/purchase-orders/${data.id}`)
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
      <div className="mb-4">
        <Link
          href="/operations/purchase-orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Purchase Orders
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <h1 className="text-lg font-semibold">New Purchase Order</h1>
          </div>

          {/* Supplier & Notes Row */}
          <div className="px-6 py-4 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.supplierId}
                onChange={e => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                required
              >
                <option value="">Select a supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.contactName ? ` (${supplier.contactName})` : ''}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground mt-1">
                  No suppliers found.{' '}
                  <Link href="/config/suppliers" className="text-primary hover:underline">
                    Add one
                  </Link>
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <Input
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Line Items</h2>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {/* Table Header */}
              <div className="grid grid-cols-14 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div className="col-span-3">SKU</div>
                <div className="col-span-2">Batch/Lot</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Unit Cost</div>
                <div className="col-span-2">Notes</div>
                <div className="col-span-1"></div>
              </div>

              {/* Line Items */}
              {lineItems.map(item => (
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
                  <div className="col-span-2">
                    <select
                      value={item.batchLot}
                      onChange={e => updateLineItem(item.id, 'batchLot', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      required
                      disabled={!item.skuId}
                    >
                      {item.skuId ? (
                        batchesLoadingBySkuId[item.skuId] ? (
                          <option value={item.batchLot || 'DEFAULT'}>Loading…</option>
                        ) : (
                          (batchesBySkuId[item.skuId] ?? ['DEFAULT']).map(batchCode => (
                            <option key={batchCode} value={batchCode}>
                              {batchCode}
                            </option>
                          ))
                        )
                      ) : (
                        <option value="DEFAULT">DEFAULT</option>
                      )}
                    </select>
                  </div>
                  <div className="col-span-3">
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
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitCost}
                        onChange={e => updateLineItem(item.id, 'unitCost', e.target.value)}
                        placeholder="0.00"
                        className="text-sm h-8 flex-1"
                      />
                      <select
                        value={item.currency}
                        onChange={e => updateLineItem(item.id, 'currency', e.target.value)}
                        className="w-16 px-1 py-1 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      >
                        {CURRENCIES.map(curr => (
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
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/operations/purchase-orders')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !formData.supplierId || lineItems.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Purchase Order'
              )}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
