'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, FileEdit, Loader2, Plus, Trash2 } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { calculateUnitCost } from '@/lib/utils/calculations'

interface Supplier {
  id: string
  name: string
  contactName: string | null
  defaultPaymentTerms: string | null
  defaultIncoterms: string | null
}

interface Sku {
  id: string
  skuCode: string
  description: string
}

interface BatchOption {
  batchCode: string
  unitsPerCarton: number | null
}

interface LineItem {
  id: string
  skuId?: string
  skuCode: string
  skuDescription: string
  batchLot: string
  unitsOrdered: number
  unitsPerCarton: number | null
  totalCost: string
  currency: string
  notes: string
}

const INCOTERMS_OPTIONS = [
  'EXW',
  'FOB',
  'FCA',
  'CFR',
  'CIF',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
] as const

const CURRENCY_OPTIONS = ['USD', 'GBP', 'EUR', 'CNY'] as const

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tenantDestination, setTenantDestination] = useState<string>('United States (US)')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [skus, setSkus] = useState<Sku[]>([])
  const [batchesBySkuId, setBatchesBySkuId] = useState<Record<string, BatchOption[]>>({})
  const [batchesLoadingBySkuId, setBatchesLoadingBySkuId] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    supplierId: '',
    currency: 'USD',
    expectedDate: '',
    incoterms: '',
    paymentTerms: '',
    notes: '',
  })
  const selectedSupplier = suppliers.find(supplier => supplier.id === formData.supplierId) ?? null
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: generateTempId(),
      skuId: undefined,
      skuCode: '',
      skuDescription: '',
      batchLot: '',
      unitsOrdered: 1,
      unitsPerCarton: null,
      totalCost: '',
      currency: formData.currency,
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
          const tenantName = tenantData?.current?.name
          const tenantCode = tenantData?.current?.displayName ?? tenantData?.current?.code
          if (typeof tenantName === 'string' && tenantName.trim()) {
            const label =
              typeof tenantCode === 'string' && tenantCode.trim()
                ? `${tenantName.trim()} (${tenantCode.trim().toUpperCase()})`
                : tenantName.trim()
            setTenantDestination(label)
          }
        }

        if (suppliersRes.ok) {
          const suppliersData = await suppliersRes.json()
          const suppliersList = suppliersData?.data || suppliersData || []
          setSuppliers(Array.isArray(suppliersList) ? suppliersList : [])
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

  const handleCurrencyChange = (nextCurrency: string) => {
    const normalized = nextCurrency.trim().toUpperCase()
    if (!normalized) return

    setFormData(prev => ({ ...prev, currency: normalized }))
    setLineItems(prev => prev.map(item => ({ ...item, currency: normalized })))
  }

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: generateTempId(),
        skuId: undefined,
        skuCode: '',
        skuDescription: '',
        batchLot: '',
        unitsOrdered: 1,
        unitsPerCarton: null,
        totalCost: '',
        currency: formData.currency,
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
      const coercePositiveInt = (value: unknown): number | null => {
        if (typeof value === 'number') {
          return Number.isInteger(value) && value > 0 ? value : null
        }
        if (typeof value === 'string' && value.trim()) {
          const parsed = Number(value.trim())
          return Number.isInteger(parsed) && parsed > 0 ? parsed : null
        }
        return null
      }

      const parsedBatches: BatchOption[] = batches
        .map((batch: Record<string, unknown>): BatchOption | null => {
          const batchCode = String(batch?.batchCode ?? '')
            .trim()
            .toUpperCase()
          if (!batchCode || batchCode === 'DEFAULT') return null

          return {
            batchCode,
            unitsPerCarton: coercePositiveInt(batch?.unitsPerCarton),
          }
        })
        .filter((batch): batch is BatchOption => Boolean(batch))

      const unique = Array.from(
        new Map(parsedBatches.map(batch => [batch.batchCode, batch])).values()
      )

      setBatchesBySkuId(prev => ({ ...prev, [skuId]: unique }))
      setLineItems(prev =>
        prev.map(item => {
          if (item.skuId !== skuId) return item
          if (unique.length === 0) {
            return {
              ...item,
              batchLot: '',
              unitsPerCarton: null,
            }
          }

          const selectedCode =
            item.batchLot && unique.some(batch => batch.batchCode === item.batchLot)
              ? item.batchLot
              : unique[0].batchCode
          const selectedBatch = unique.find(batch => batch.batchCode === selectedCode)

          return {
            ...item,
            batchLot: selectedCode,
            unitsPerCarton: selectedBatch?.unitsPerCarton ?? null,
          }
        })
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load batches')
      setBatchesBySkuId(prev => ({ ...prev, [skuId]: [] }))
    } finally {
      setBatchesLoadingBySkuId(prev => ({ ...prev, [skuId]: false }))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: LineItem[keyof LineItem]) => {
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
                  batchLot: '',
                  unitsPerCarton: null,
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
                batchLot: '',
                unitsPerCarton: null,
              }
            : item
        )
      )
      void ensureSkuBatchesLoaded(selectedSku.id)
      return
    }

    if (field === 'batchLot') {
      const batchLot = String(value).trim().toUpperCase()
      setLineItems(prev =>
        prev.map(item => {
          if (item.id !== id) return item
          if (!item.skuId) return { ...item, batchLot }

          const batches = batchesBySkuId[item.skuId] ?? []
          const selectedBatch = batches.find(batch => batch.batchCode === batchLot)
          return {
            ...item,
            batchLot,
            unitsPerCarton: selectedBatch?.unitsPerCarton ?? null,
          }
        })
      )
      return
    }

    setLineItems(prev =>
      prev.map(item => (item.id === id ? ({ ...item, [field]: value } as LineItem) : item))
    )
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const handleSupplierChange = (supplierId: string) => {
    const nextSupplier = suppliers.find(supplier => supplier.id === supplierId)
    setFormData(prev => ({
      ...prev,
      supplierId,
      paymentTerms: nextSupplier?.defaultPaymentTerms?.trim() || '',
      incoterms: nextSupplier?.defaultIncoterms?.trim().toUpperCase() || '',
    }))
  }

  const parseMoney = (value: string): number | null => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return parsed
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (!formData.expectedDate) {
      toast.error('Please set a cargo ready date')
      return
    }

    if (!formData.incoterms) {
      toast.error('Please select incoterms')
      return
    }

    if (!formData.paymentTerms.trim()) {
      toast.error('Please enter payment terms')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    const isPositiveInteger = (value: unknown): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value > 0

    const invalidLines = lineItems.filter(item => {
      if (!item.skuCode) return true
      const batchLot = item.batchLot.trim()
      if (!batchLot) return true
      if (batchLot.toUpperCase() === 'DEFAULT') return true
      if (!isPositiveInteger(item.unitsOrdered)) return true
      if (!isPositiveInteger(item.unitsPerCarton)) return true
      return false
    })
    if (invalidLines.length > 0) {
      toast.error(
        'Please fill in SKU, batch/lot, units ordered, and units per carton for all line items'
      )
      return
    }

    if (!selectedSupplier) {
      toast.error('Invalid supplier selected')
      return
    }

    const invalidCostLine = lineItems.find(line => {
      if (!line.totalCost.trim()) return false
      return parseMoney(line.totalCost) === null
    })
    if (invalidCostLine) {
      toast.error(`Invalid actual cost for SKU ${invalidCostLine.skuCode || 'line item'}`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchWithCSRF('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyName: selectedSupplier.name,
          expectedDate: formData.expectedDate,
          incoterms: formData.incoterms,
          paymentTerms: formData.paymentTerms.trim(),
          notes: formData.notes || undefined,
          lines: lineItems.map(item => ({
            skuCode: item.skuCode,
            skuDescription: item.skuDescription,
            batchLot: item.batchLot.trim().toUpperCase(),
            unitsOrdered: item.unitsOrdered,
            unitsPerCarton: item.unitsPerCarton ?? 1,
            ...(parseMoney(item.totalCost) !== null
              ? { totalCost: parseMoney(item.totalCost) ?? 0 }
              : {}),
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
        <PageContainer>
          <PageContent className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </PageContent>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="New Purchase Order"
          description="Operations"
          icon={FileEdit}
          actions={
            <Button variant="outline" asChild className="gap-2">
              <Link href="/operations/purchase-orders">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          }
        />
        <PageContent>
          <form onSubmit={handleSubmit}>
            {/* Two-column layout: Order Details (left) + Line Items (right) */}
            <div className="flex gap-6 items-start">
              {/* Left Column: Order Details - Fixed width */}
              <div className="w-[340px] flex-shrink-0 space-y-4">
                <div className="rounded-xl border bg-white p-5 space-y-4 overflow-visible">
                  <h3 className="text-sm font-semibold text-slate-900">Order Details</h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.supplierId}
                      onChange={e => handleSupplierChange(e.target.value)}
                      className="w-full h-9 px-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                          {supplier.contactName ? ` (${supplier.contactName})` : ''}
                        </option>
                      ))}
                    </select>
                    {suppliers.length === 0 && !loading && (
                      <p className="text-xs text-muted-foreground">
                        No suppliers.{' '}
                        <Link href="/config/suppliers" className="text-cyan-600 hover:underline">
                          Add one
                        </Link>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Destination</label>
                    <Input
                      value={tenantDestination}
                      disabled
                      readOnly
                      className="h-9 text-sm bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.currency}
                      onChange={e => handleCurrencyChange(e.target.value)}
                      className="w-full h-9 px-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      required
                    >
                      {CURRENCY_OPTIONS.map(currency => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Cargo Ready Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.expectedDate}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, expectedDate: e.target.value }))
                      }
                      className="h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Incoterms <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.incoterms}
                      onChange={e => setFormData(prev => ({ ...prev, incoterms: e.target.value }))}
                      className="w-full h-9 px-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      required
                    >
                      <option value="">Select incoterms</option>
                      {INCOTERMS_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {formData.supplierId && !selectedSupplier?.defaultIncoterms && (
                      <p className="text-[11px] text-amber-600">
                        No default incoterms for this supplier
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Payment Terms <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.paymentTerms}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))
                      }
                      placeholder="e.g., 30% deposit, 70% before shipment"
                      className="h-9 text-sm"
                      required
                    />
                    {formData.supplierId && !selectedSupplier?.defaultPaymentTerms && (
                      <p className="text-[11px] text-amber-600">
                        No default payment terms for this supplier
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Notes</label>
                    <Textarea
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional internal notes…"
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Action buttons - sticky at bottom of left column */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/operations/purchase-orders')}
                    disabled={submitting}
                    className="flex-1 h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      !formData.supplierId ||
                      !formData.expectedDate ||
                      !formData.incoterms ||
                      !formData.paymentTerms.trim() ||
                      lineItems.length === 0
                    }
                    className="flex-1 h-9"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Order'
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Column: Line Items - Flexible width */}
              <div className="flex-1 min-w-0">
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/50">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Line Items</h3>
                      <p className="text-xs text-muted-foreground">
                        {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[980px]">
                      {/* Table Header */}
                      <div className="grid grid-cols-14 gap-2 text-xs font-medium text-muted-foreground px-4 py-2.5 border-b bg-slate-50/30">
                        <div className="col-span-2">SKU</div>
                        <div className="col-span-2">Batch/Lot</div>
                        <div className="col-span-3">Description</div>
                        <div className="col-span-1">Units</div>
                        <div className="col-span-1">Units/Ctn</div>
                        <div className="col-span-1">Cartons</div>
                        <div className="col-span-2">Total Cost</div>
                        <div className="col-span-2">Notes</div>
                      </div>

                      {/* Line Items */}
                      <div className="divide-y">
                        {lineItems.map(item => (
                          <div
                            key={item.id}
                            className="grid grid-cols-14 gap-2 items-start px-4 py-3 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="col-span-2">
                              <select
                                value={item.skuCode}
                                onChange={e => updateLineItem(item.id, 'skuCode', e.target.value)}
                                className="w-full h-8 px-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
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
                                className="w-full h-8 px-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                                required
                                disabled={!item.skuId}
                              >
                                {item.skuId ? (
                                  batchesLoadingBySkuId[item.skuId] ? (
                                    <option value="">Loading…</option>
                                  ) : (batchesBySkuId[item.skuId] ?? []).length > 0 ? (
                                    <>
                                      <option value="">Select batch</option>
                                      {(batchesBySkuId[item.skuId] ?? []).map(batch => (
                                        <option key={batch.batchCode} value={batch.batchCode}>
                                          {batch.batchCode}
                                        </option>
                                      ))}
                                    </>
                                  ) : (
                                    <option value="">No batches</option>
                                  )
                                ) : (
                                  <option value="">Select SKU first</option>
                                )}
                              </select>
                            </div>
                            <div className="col-span-3">
                              <Input
                                value={item.skuDescription}
                                onChange={e =>
                                  updateLineItem(item.id, 'skuDescription', e.target.value)
                                }
                                placeholder="Description"
                                className="text-sm h-8"
                              />
                            </div>
                            <div className="col-span-1">
                              <Input
                                type="number"
                                min="1"
                                value={item.unitsOrdered}
                                onChange={e =>
                                  updateLineItem(
                                    item.id,
                                    'unitsOrdered',
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="text-sm h-8"
                                required
                              />
                            </div>
                            <div className="col-span-1">
                              <Input
                                type="number"
                                min="1"
                                value={item.unitsPerCarton ?? ''}
                                onChange={e =>
                                  updateLineItem(
                                    item.id,
                                    'unitsPerCarton',
                                    (() => {
                                      const parsed = Number.parseInt(e.target.value, 10)
                                      return Number.isInteger(parsed) && parsed > 0 ? parsed : null
                                    })()
                                  )
                                }
                                placeholder="—"
                                className="text-sm h-8"
                                disabled={!item.skuId || !item.batchLot}
                                required
                              />
                            </div>
                            <div className="col-span-1">
                              <Input
                                value={(() => {
                                  if (!item.unitsPerCarton) return '—'
                                  if (item.unitsOrdered <= 0) return '—'
                                  return String(Math.ceil(item.unitsOrdered / item.unitsPerCarton))
                                })()}
                                readOnly
                                className="text-sm h-8 bg-muted/30 text-muted-foreground"
                              />
                            </div>
                            <div className="col-span-2">
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.totalCost}
                                  onChange={e =>
                                    updateLineItem(item.id, 'totalCost', e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="text-sm h-8 pr-12"
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-xs font-medium text-muted-foreground">
                                  {item.currency}
                                </div>
                              </div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                Unit:{' '}
                                {(() => {
                                  const money = parseMoney(item.totalCost)
                                  if (money === null) return '—'
                                  const unit = calculateUnitCost(money, item.unitsOrdered, 4)
                                  return `${unit.toFixed(4)}`
                                })()}
                              </p>
                            </div>
                            <div className="col-span-2 flex gap-1.5">
                              <Input
                                value={item.notes}
                                onChange={e => updateLineItem(item.id, 'notes', e.target.value)}
                                placeholder="Notes"
                                className="text-sm h-8 flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(item.id)}
                                disabled={lineItems.length === 1}
                                className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
