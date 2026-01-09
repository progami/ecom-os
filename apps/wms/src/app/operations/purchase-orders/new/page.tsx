'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, FileEdit, Loader2, Plus, Trash2 } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'

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
  cartonDimensionsCm: string | null
  cartonLengthCm: number | null
  cartonWidthCm: number | null
  cartonHeightCm: number | null
  cartonWeightKg: number | null
  packagingType: string | null
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
      const coercePositiveNumber = (value: unknown): number | null => {
        if (typeof value === 'number') {
          return Number.isFinite(value) && value > 0 ? value : null
        }
        if (typeof value === 'string' && value.trim()) {
          const parsed = Number(value.trim())
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null
        }
        return null
      }
      const coerceString = (value: unknown): string | null => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed ? trimmed : null
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
            cartonDimensionsCm: coerceString(batch?.cartonDimensionsCm),
            cartonLengthCm: coercePositiveNumber(batch?.cartonLengthCm),
            cartonWidthCm: coercePositiveNumber(batch?.cartonWidthCm),
            cartonHeightCm: coercePositiveNumber(batch?.cartonHeightCm),
            cartonWeightKg: coercePositiveNumber(batch?.cartonWeightKg),
            packagingType: (() => {
              const raw = coerceString(batch?.packagingType)
              return raw ? raw.toUpperCase() : null
            })(),
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

  interface PackagingDetails {
    cartonDims: string | null
    cbmPerCarton: string | null
    cbmTotal: string | null
    kgPerCarton: string | null
    kgTotal: string | null
    packagingType: string | null
    hasWarning: boolean
  }

  const getLinePackagingDetails = (item: LineItem): PackagingDetails | null => {
    if (!item.skuId || !item.batchLot) return null
    const batchCode = item.batchLot.trim().toUpperCase()
    if (!batchCode) return null

    const batch = (batchesBySkuId[item.skuId] ?? []).find(b => b.batchCode === batchCode) ?? null
    if (!batch) return null

    const cartonTriplet = resolveDimensionTripletCm({
      lengthCm: batch.cartonLengthCm,
      widthCm: batch.cartonWidthCm,
      heightCm: batch.cartonHeightCm,
      legacy: batch.cartonDimensionsCm,
    })

    const cartons =
      item.unitsPerCarton && item.unitsOrdered > 0
        ? Math.ceil(item.unitsOrdered / item.unitsPerCarton)
        : null

    const hasWarning = !cartonTriplet && !batch.cartonWeightKg && !batch.packagingType

    let cbmPerCarton: number | null = null
    if (cartonTriplet) {
      cbmPerCarton =
        (cartonTriplet.lengthCm * cartonTriplet.widthCm * cartonTriplet.heightCm) / 1_000_000
    }

    return {
      cartonDims: cartonTriplet ? `${formatDimensionTripletCm(cartonTriplet)} cm` : null,
      cbmPerCarton: cbmPerCarton !== null ? cbmPerCarton.toFixed(3) : null,
      cbmTotal: cbmPerCarton !== null && cartons ? (cbmPerCarton * cartons).toFixed(3) : null,
      kgPerCarton: batch.cartonWeightKg ? batch.cartonWeightKg.toFixed(2) : null,
      kgTotal: batch.cartonWeightKg && cartons ? (batch.cartonWeightKg * cartons).toFixed(2) : null,
      packagingType: batch.packagingType ?? null,
      hasWarning,
    }
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

  const lineTotals = (() => {
    let totalUnits = 0
    let totalCartons = 0
    let totalCost = 0
    let hasCost = false
    let totalCbm = 0
    let hasCbm = false
    let totalKg = 0
    let hasKg = false

    lineItems.forEach(item => {
      totalUnits += item.unitsOrdered > 0 ? item.unitsOrdered : 0

      const cartons =
        item.unitsPerCarton && item.unitsOrdered > 0
          ? Math.ceil(item.unitsOrdered / item.unitsPerCarton)
          : null
      if (cartons !== null) {
        totalCartons += cartons
      }

      const parsedCost = parseMoney(item.totalCost)
      if (parsedCost !== null) {
        totalCost += parsedCost
        hasCost = true
      }

      if (!item.skuId || !item.batchLot || cartons === null) return
      const batchCode = item.batchLot.trim().toUpperCase()
      if (!batchCode) return
      const batch = (batchesBySkuId[item.skuId] ?? []).find(b => b.batchCode === batchCode) ?? null
      if (!batch) return

      const cartonTriplet = resolveDimensionTripletCm({
        lengthCm: batch.cartonLengthCm,
        widthCm: batch.cartonWidthCm,
        heightCm: batch.cartonHeightCm,
        legacy: batch.cartonDimensionsCm,
      })
      if (cartonTriplet) {
        const cbmPerCarton =
          (cartonTriplet.lengthCm * cartonTriplet.widthCm * cartonTriplet.heightCm) / 1_000_000
        totalCbm += cbmPerCarton * cartons
        hasCbm = true
      }

      if (batch.cartonWeightKg) {
        totalKg += batch.cartonWeightKg * cartons
        hasKg = true
      }
    })

    return {
      totalUnits,
      totalCartons,
      totalCost,
      hasCost,
      totalCbm,
      hasCbm,
      totalKg,
      hasKg,
    }
  })()

  if (status === 'loading' || loading) {
    return (
      <PageContainer>
        <PageContent className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </PageContent>
      </PageContainer>
    )
  }

  return (
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
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Order Details - Document Header Style */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-700">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                Order Details
              </h2>
            </div>

            <div className="p-5 space-y-5">
              {/* Row 1: Supplier + Destination - Two prominent fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    Supplier
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={e => handleSupplierChange(e.target.value)}
                    className="w-full h-11 px-4 border-2 border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium transition-colors"
                    required
                  >
                    <option value="" className="text-slate-400">
                      Select supplier...
                    </option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.contactName ? ` — ${supplier.contactName}` : ''}
                      </option>
                    ))}
                  </select>
                  {suppliers.length === 0 && !loading && (
                    <p className="text-xs text-slate-500">
                      No suppliers configured.{' '}
                      <Link
                        href="/config/suppliers"
                        className="text-cyan-600 font-medium hover:underline"
                      >
                        Add one →
                      </Link>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    Ship To
                  </label>
                  <div className="h-11 px-4 flex items-center border-2 border-slate-100 rounded-lg bg-slate-50 text-sm font-medium text-slate-600">
                    {tenantDestination}
                  </div>
                </div>
              </div>

              {/* Row 2: Cargo details - 4 columns with visual grouping */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={e => handleCurrencyChange(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-mono font-semibold transition-colors"
                    required
                  >
                    {CURRENCY_OPTIONS.map(currency => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Cargo Ready
                  </label>
                  <Input
                    type="date"
                    value={formData.expectedDate}
                    onChange={e => setFormData(prev => ({ ...prev, expectedDate: e.target.value }))}
                    className="h-10 text-sm font-medium border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Incoterms
                  </label>
                  <select
                    value={formData.incoterms}
                    onChange={e => setFormData(prev => ({ ...prev, incoterms: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 rounded-md bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-mono font-semibold transition-colors"
                    required
                  >
                    <option value="" className="text-slate-400">
                      Select
                    </option>
                    {INCOTERMS_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Payment Terms
                  </label>
                  <Input
                    value={formData.paymentTerms}
                    onChange={e => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    placeholder="e.g., 30/70"
                    className="h-10 text-sm font-medium border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              {/* Row 3: Notes - full width with subtle styling */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Internal Notes
                </label>
                <Input
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes for internal reference..."
                  className="h-10 text-sm border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Section Header with Stats */}
            <div className="px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                  Line Items
                </h2>
                {/* Summary Stats as Pills */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white/90 tabular-nums">
                    {lineItems.length} SKU{lineItems.length !== 1 ? 's' : ''}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white/90 tabular-nums">
                    {lineTotals.totalUnits.toLocaleString()} units
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white/90 tabular-nums">
                    {lineTotals.totalCartons.toLocaleString()} ctns
                  </span>
                  {lineTotals.hasCbm && (
                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-200 tabular-nums">
                      {lineTotals.totalCbm.toFixed(2)} m³
                    </span>
                  )}
                  {lineTotals.hasKg && (
                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-200 tabular-nums">
                      {lineTotals.totalKg.toFixed(1)} kg
                    </span>
                  )}
                  {lineTotals.hasCost && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-200 tabular-nums">
                      {formData.currency}{' '}
                      {lineTotals.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addLineItem}
                className="bg-white/10 hover:bg-white/20 text-white border-0 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Line
              </Button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                {/* Table Header */}
                <div className="grid grid-cols-16 gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="col-span-2">Product</div>
                  <div className="col-span-2">Batch</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-1 text-right">U/Ctn</div>
                  <div className="col-span-1 text-right">Ctns</div>
                  <div className="col-span-2 text-right">Cost</div>
                  <div className="col-span-3">Notes</div>
                </div>

                {/* Line Items */}
                <div className="divide-y divide-slate-100">
                  {lineItems.map(item => {
                    const pkg = getLinePackagingDetails(item)
                    const parsedCost = parseMoney(item.totalCost)
                    const unitCost =
                      parsedCost !== null && item.unitsOrdered > 0
                        ? parsedCost / item.unitsOrdered
                        : null
                    const cartons =
                      item.unitsPerCarton && item.unitsOrdered > 0
                        ? Math.ceil(item.unitsOrdered / item.unitsPerCarton)
                        : null
                    return (
                      <div key={item.id} className="group">
                        {/* Main Row */}
                        <div className="grid grid-cols-16 gap-3 items-center px-5 py-4 bg-white hover:bg-slate-50/50 transition-colors">
                          {/* SKU */}
                          <div className="col-span-2">
                            <select
                              value={item.skuCode}
                              onChange={e => updateLineItem(item.id, 'skuCode', e.target.value)}
                              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-semibold transition-colors"
                              required
                            >
                              <option value="" className="text-slate-400">
                                Select...
                              </option>
                              {skus.map(sku => (
                                <option key={sku.id} value={sku.skuCode}>
                                  {sku.skuCode}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Batch */}
                          <div className="col-span-2">
                            <select
                              value={item.batchLot}
                              onChange={e => updateLineItem(item.id, 'batchLot', e.target.value)}
                              className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
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
                                <option value="" className="text-slate-400">
                                  —
                                </option>
                              )}
                            </select>
                          </div>

                          {/* Description */}
                          <div className="col-span-3">
                            <Input
                              value={item.skuDescription}
                              onChange={e =>
                                updateLineItem(item.id, 'skuDescription', e.target.value)
                              }
                              placeholder="Product description"
                              className="h-9 text-sm border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-slate-300"
                            />
                          </div>

                          {/* Qty */}
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
                              className="h-9 text-sm font-semibold text-right tabular-nums border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                              required
                            />
                          </div>

                          {/* U/Ctn */}
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
                              className="h-9 text-sm text-right tabular-nums border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-slate-50 placeholder:text-slate-300"
                              disabled={!item.skuId || !item.batchLot}
                              required
                            />
                          </div>

                          {/* Ctns (calculated) */}
                          <div className="col-span-1">
                            <div className="h-9 px-3 flex items-center justify-end rounded-md bg-slate-100 text-sm font-bold tabular-nums text-slate-600">
                              {cartons ?? '—'}
                            </div>
                          </div>

                          {/* Total Cost */}
                          <div className="col-span-2">
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.totalCost}
                                onChange={e => updateLineItem(item.id, 'totalCost', e.target.value)}
                                placeholder="0.00"
                                className="h-9 text-sm text-right tabular-nums pr-14 border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-slate-300"
                              />
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[11px] font-bold text-slate-400">
                                {item.currency}
                              </div>
                            </div>
                            {unitCost !== null && (
                              <p className="mt-1 text-[10px] font-medium text-slate-400 text-right tabular-nums">
                                @ {unitCost.toFixed(4)}/{item.currency.toLowerCase()}
                              </p>
                            )}
                          </div>

                          {/* Notes + Delete */}
                          <div className="col-span-3 flex gap-2">
                            <Input
                              value={item.notes}
                              onChange={e => updateLineItem(item.id, 'notes', e.target.value)}
                              placeholder="Line notes..."
                              className="h-9 text-sm flex-1 border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 placeholder:text-slate-300"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                              className="h-9 w-9 p-0 flex-shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-20 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Packaging Details Card */}
                        {pkg && (
                          <div
                            className={`mx-5 mb-4 rounded-lg border overflow-hidden ${
                              pkg.hasWarning
                                ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-amber-50/50'
                                : 'border-slate-200 bg-gradient-to-r from-slate-50 to-white'
                            }`}
                          >
                            <div className="grid grid-cols-6 divide-x divide-slate-200/50">
                              {/* Carton Dimensions */}
                              <div className="px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Carton
                                </p>
                                <p
                                  className={`text-sm font-semibold tabular-nums ${pkg.cartonDims ? 'text-slate-700' : 'text-amber-600'}`}
                                >
                                  {pkg.cartonDims ?? 'Not set'}
                                </p>
                              </div>

                              {/* CBM per Carton */}
                              <div className="px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  CBM/ctn
                                </p>
                                <p className="text-sm font-semibold tabular-nums text-slate-700">
                                  {pkg.cbmPerCarton ?? '—'}
                                </p>
                              </div>

                              {/* CBM Total */}
                              <div className="px-4 py-3 bg-cyan-50/30">
                                <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">
                                  CBM Total
                                </p>
                                <p className="text-sm font-bold tabular-nums text-cyan-700">
                                  {pkg.cbmTotal ?? '—'}
                                </p>
                              </div>

                              {/* KG per Carton */}
                              <div className="px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  KG/ctn
                                </p>
                                <p className="text-sm font-semibold tabular-nums text-slate-700">
                                  {pkg.kgPerCarton ?? '—'}
                                </p>
                              </div>

                              {/* KG Total */}
                              <div className="px-4 py-3 bg-cyan-50/30">
                                <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">
                                  KG Total
                                </p>
                                <p className="text-sm font-bold tabular-nums text-cyan-700">
                                  {pkg.kgTotal ?? '—'}
                                </p>
                              </div>

                              {/* Packaging Type */}
                              <div className="px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Pkg Type
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                  {pkg.packagingType ?? '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/operations/purchase-orders')}
              disabled={submitting}
              className="h-10 px-6 text-sm font-medium border-slate-200 hover:bg-slate-50"
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
              className="h-10 px-8 text-sm font-semibold bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Order...
                </>
              ) : (
                'Create Purchase Order'
              )}
            </Button>
          </div>
        </form>
      </PageContent>
    </PageContainer>
  )
}
