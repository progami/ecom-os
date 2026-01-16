'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PortalModal } from '@/components/ui/portal-modal'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { SKU_FIELD_LIMITS } from '@/lib/sku-constants'
import { Edit2, Loader2, Package2, Plus, Search, Trash2 } from '@/lib/lucide-icons'

type SkuModalTab = 'reference' | 'amazon'

const AMAZON_REFERRAL_CATEGORIES_2026 = [
  'Amazon Device Accessories',
  'Appliances - Compact',
  'Appliances - Full-size',
  'Automotive and Powersports',
  'Baby Products',
  'Backpacks, Handbags, Luggage',
  'Base Equipment Power Tools',
  'Beauty, Health, Personal Care',
  'Books',
  'Business, Industrial, Scientific',
  'Clothing and Accessories',
  'Computers',
  'Consumer Electronics',
  'DVD',
  'Electronics Accessories',
  'Everything Else',
  'Eyewear',
  'Fine Art',
  'Footwear',
  'Furniture',
  'Gift Cards',
  'Grocery and Gourmet',
  'Home and Kitchen',
  'Jewelry',
  'Lawn and Garden',
  'Lawn Mowers & Snow Throwers',
  'Mattresses',
  'Merchant Fulfilled Services',
  'Music',
  'Musical Instruments & AV',
  'Office Products',
  'Pet Supplies',
  'Software',
  'Sports and Outdoors',
  'Tires',
  'Tools and Home Improvement',
  'Toys and Games',
  'Video',
  'Video Game Consoles',
  'Video Games & Gaming Accessories',
  'Watches',
] as const

type AmazonReferralCategory = (typeof AMAZON_REFERRAL_CATEGORIES_2026)[number]

const AMAZON_CATEGORY_TO_REFERRAL_CATEGORY = new Map<string, AmazonReferralCategory>([
  ['Home Improvement', 'Tools and Home Improvement'],
])

function normalizeReferralCategory(value: string): string {
  const mapped = AMAZON_CATEGORY_TO_REFERRAL_CATEGORY.get(value)
  if (mapped) return mapped
  return value
}

function formatReferralCategoryLabel(category: AmazonReferralCategory): string {
  if (category === 'Tools and Home Improvement') return 'Tools and Home Improvement (Home Improvement)'
  return category
}

const AMAZON_SIZE_TIER_OPTIONS = [
  'Small Standard-Size',
  'Large Standard-Size',
  'Standard-Size',
  'Small Oversize',
  'Medium Oversize',
  'Large Oversize',
  'Special Oversize',
  'Oversize',
  'Small and Light',
] as const

interface SkuBatchRow {
  id: string
  batchCode: string
  description: string | null
  productionDate: string | null
  expiryDate: string | null
  packSize: number | null
  unitsPerCarton: number | null
  material: string | null
  unitDimensionsCm: string | null
  unitSide1Cm: number | string | null
  unitSide2Cm: number | string | null
  unitSide3Cm: number | string | null
  unitWeightKg: number | string | null
  cartonDimensionsCm: string | null
  cartonSide1Cm: number | string | null
  cartonSide2Cm: number | string | null
  cartonSide3Cm: number | string | null
  cartonWeightKg: number | string | null
  packagingType: string | null
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  createdAt: string
  updatedAt: string
}

interface SkuRow {
  id: string
  skuCode: string
  description: string
  asin: string | null
  unitDimensionsCm?: string | null
  category?: string | null
  sizeTier?: string | null
  referralFeePercent?: number | string | null
  fbaFulfillmentFee?: number | string | null
  amazonCategory?: string | null
  amazonSubcategory?: string | null
  amazonSizeTier?: string | null
  amazonReferralFeePercent?: number | string | null
  amazonFbaFulfillmentFee?: number | string | null
  amazonReferenceWeightKg?: number | string | null
  itemDimensionsCm?: string | null
  itemSide1Cm?: number | string | null
  itemSide2Cm?: number | string | null
  itemSide3Cm?: number | string | null
  itemWeightKg?: number | string | null
  packSize: number | null
  defaultSupplierId?: string | null
  secondarySupplierId?: string | null
  _count?: { inventoryTransactions: number }
  batches?: SkuBatchRow[]
}

interface SupplierOption {
  id: string
  name: string
}

interface SkuFormState {
  skuCode: string
  description: string
  asin: string
  productDimensionsCm: string
  category: string
  sizeTier: string
  referralFeePercent: string
  fbaFulfillmentFee: string
  amazonCategory: string
  amazonSubcategory: string
  amazonSizeTier: string
  amazonReferralFeePercent: string
  amazonFbaFulfillmentFee: string
  amazonReferenceWeightKg: string
  itemSide1Cm: string
  itemSide2Cm: string
  itemSide3Cm: string
  itemWeightKg: string
  defaultSupplierId: string
  secondarySupplierId: string
  initialBatch: {
    batchCode: string
    packSize: string
    unitsPerCarton: string
    unitWeightKg: string
    packagingType: string
  }
}

function buildFormState(sku?: SkuRow | null): SkuFormState {
  // Parse item dimensions from individual values or legacy combined string
  let side1 = ''
  let side2 = ''
  let side3 = ''

  if (sku?.itemSide1Cm != null) {
    side1 = String(sku.itemSide1Cm)
  }
  if (sku?.itemSide2Cm != null) {
    side2 = String(sku.itemSide2Cm)
  }
  if (sku?.itemSide3Cm != null) {
    side3 = String(sku.itemSide3Cm)
  }

  // Fallback to parsing legacy combined string if individual values not present
  if (!side1 && !side2 && !side3 && sku?.itemDimensionsCm) {
    const parts = sku.itemDimensionsCm.split(/[x×]/i).map(p => p.trim())
    if (parts.length === 3) {
      side1 = parts[0]
      side2 = parts[1]
      side3 = parts[2]
    }
  }

  let category = ''
  if (sku?.category) {
    category = sku.category
  } else if (sku?.amazonCategory) {
    const mapped = AMAZON_CATEGORY_TO_REFERRAL_CATEGORY.get(sku.amazonCategory)
    if (mapped) category = mapped
  }

  return {
    skuCode: sku?.skuCode ?? '',
    description: sku?.description ?? '',
    asin: sku?.asin ?? '',
    productDimensionsCm: sku?.unitDimensionsCm ?? '',
    category,
    sizeTier: sku?.sizeTier ?? '',
    referralFeePercent: sku?.referralFeePercent?.toString?.() ?? '',
    fbaFulfillmentFee: sku?.fbaFulfillmentFee?.toString?.() ?? '',
    amazonCategory: sku?.amazonCategory ?? '',
    amazonSubcategory: sku?.amazonSubcategory ?? '',
    amazonSizeTier: sku?.amazonSizeTier ?? '',
    amazonReferralFeePercent: sku?.amazonReferralFeePercent?.toString?.() ?? '',
    amazonFbaFulfillmentFee: sku?.amazonFbaFulfillmentFee?.toString?.() ?? '',
    amazonReferenceWeightKg: sku?.amazonReferenceWeightKg?.toString?.() ?? '',
    itemSide1Cm: side1,
    itemSide2Cm: side2,
    itemSide3Cm: side3,
    itemWeightKg: sku?.itemWeightKg?.toString?.() ?? '',
    defaultSupplierId: sku?.defaultSupplierId ?? '',
    secondarySupplierId: sku?.secondarySupplierId ?? '',
    initialBatch: {
      batchCode: '',
      packSize: '1',
      unitsPerCarton: '1',
      unitWeightKg: '',
      packagingType: '',
    },
  }
}

interface SkusPanelProps {
  externalModalOpen?: boolean
  externalEditSkuId?: string | null
  onExternalModalClose?: () => void
}

export default function SkusPanel({ externalModalOpen, externalEditSkuId, onExternalModalClose }: SkusPanelProps) {
  const router = useRouter()
  const [skus, setSkus] = useState<SkuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSku, setEditingSku] = useState<SkuRow | null>(null)
  const [formState, setFormState] = useState<SkuFormState>(() => buildFormState())

  const [confirmDelete, setConfirmDelete] = useState<SkuRow | null>(null)
  const [modalTab, setModalTab] = useState<SkuModalTab>('reference')
  const [externalEditOpened, setExternalEditOpened] = useState(false)

  // Handle external modal open trigger
  useEffect(() => {
    if (externalModalOpen) {
      setEditingSku(null)
      setFormState(buildFormState(null))
      setIsModalOpen(true)
    }
  }, [externalModalOpen])

  useEffect(() => {
    setExternalEditOpened(false)
  }, [externalEditSkuId])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    return params.toString()
  }, [searchTerm])

  const fetchSkus = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/skus?${buildQuery()}`, { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load SKUs')
      }

      const data = await response.json()
      const rows: SkuRow[] = Array.isArray(data) ? data : []
      setSkus(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load SKUs')
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    fetchSkus()
  }, [fetchSkus])

  const fetchSuppliers = useCallback(async () => {
    try {
      setSuppliersLoading(true)
      const response = await fetch('/api/suppliers', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load suppliers')
      }

      const payload = await response.json()
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : []
      setSuppliers(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load suppliers')
      setSuppliers([])
    } finally {
      setSuppliersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const filteredSkus = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return skus.filter(sku => {
      if (!term) return true

      return (
        sku.skuCode.toLowerCase().includes(term) ||
        sku.description.toLowerCase().includes(term) ||
        (sku.asin ?? '').toLowerCase().includes(term)
      )
    })
  }, [skus, searchTerm])

  const openCreate = useCallback(() => {
    setEditingSku(null)
    setFormState(buildFormState(null))
    setModalTab('reference')
    setIsModalOpen(true)
  }, [])

  const openEdit = useCallback((sku: SkuRow) => {
    setEditingSku(sku)
    setFormState(buildFormState(sku))
    setModalTab('reference')
    setIsModalOpen(true)
  }, [])

  useEffect(() => {
    if (!externalEditSkuId) return
    if (externalEditOpened) return
    if (skus.length === 0) return
    const sku = skus.find(item => item.id === externalEditSkuId)
    if (!sku) return
    openEdit(sku)
    setExternalEditOpened(true)
  }, [externalEditOpened, externalEditSkuId, openEdit, skus])

  const closeModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setEditingSku(null)
    setFormState(buildFormState(null))
    onExternalModalClose?.()
  }

  const submitSku = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    if (
      formState.defaultSupplierId &&
      formState.secondarySupplierId &&
      formState.defaultSupplierId === formState.secondarySupplierId
    ) {
      toast.error('Default and secondary supplier must be different')
      return
    }

    const skuCode = formState.skuCode.trim()
    const description = formState.description.trim()
    const asinValue = formState.asin.trim() ? formState.asin.trim() : null

    if (!skuCode) {
      toast.error('SKU code is required')
      return
    }

    if (!description) {
      toast.error('Description is required')
      return
    }

    // Parse reference unit dimension fields
    const side1Raw = formState.itemSide1Cm.trim()
    const side2Raw = formState.itemSide2Cm.trim()
    const side3Raw = formState.itemSide3Cm.trim()
    const itemWeightRaw = formState.itemWeightKg.trim()

    let itemSide1Cm: number | null = null
    let itemSide2Cm: number | null = null
    let itemSide3Cm: number | null = null

    // All three dimensions must be provided together, or none at all
    const hasAnyDimension = side1Raw || side2Raw || side3Raw
    if (hasAnyDimension) {
      if (!side1Raw || !side2Raw || !side3Raw) {
        toast.error('Unit dimensions require length, width, and height')
        return
      }

      itemSide1Cm = Number.parseFloat(side1Raw)
      itemSide2Cm = Number.parseFloat(side2Raw)
      itemSide3Cm = Number.parseFloat(side3Raw)

      if (!Number.isFinite(itemSide1Cm) || itemSide1Cm <= 0) {
        toast.error('Unit length must be a positive number')
        return
      }
      if (!Number.isFinite(itemSide2Cm) || itemSide2Cm <= 0) {
        toast.error('Unit width must be a positive number')
        return
      }
      if (!Number.isFinite(itemSide3Cm) || itemSide3Cm <= 0) {
        toast.error('Unit height must be a positive number')
        return
      }
    }

    let itemWeightKg: number | null = null
    if (itemWeightRaw) {
      itemWeightKg = Number.parseFloat(itemWeightRaw)
      if (!Number.isFinite(itemWeightKg) || itemWeightKg <= 0) {
        toast.error('Unit weight (kg) must be a positive number')
        return
      }
    }

    // Parse reference fee fields
    const categoryTrimmed = formState.category.trim()
    const normalizedCategory = categoryTrimmed ? normalizeReferralCategory(categoryTrimmed) : ''
    const categoryValue = normalizedCategory ? normalizedCategory : null
    const sizeTierTrimmed = formState.sizeTier.trim()
    const sizeTierValue = sizeTierTrimmed ? sizeTierTrimmed : null
    let referralFeePercent: number | null = null
    let fbaFulfillmentFee: number | null = null

    if (formState.referralFeePercent.trim()) {
      referralFeePercent = Number.parseFloat(formState.referralFeePercent)
      if (!Number.isFinite(referralFeePercent) || referralFeePercent < 0 || referralFeePercent > 100) {
        toast.error('Referral fee must be between 0 and 100')
        return
      }
    }

    if (formState.fbaFulfillmentFee.trim()) {
      fbaFulfillmentFee = Number.parseFloat(formState.fbaFulfillmentFee)
      if (!Number.isFinite(fbaFulfillmentFee) || fbaFulfillmentFee < 0) {
        toast.error('FBA fulfillment fee must be a non-negative number')
        return
      }
    }

    const isCreating = !editingSku
    let initialBatchPayload: Record<string, unknown> | null = null

    if (isCreating) {
      const batchCode = formState.initialBatch.batchCode.trim()
      if (!batchCode) {
        toast.error('Batch code is required')
        return
      }

      const packSize = Number.parseInt(formState.initialBatch.packSize, 10)
      if (!Number.isFinite(packSize) || packSize <= 0) {
        toast.error('Pack size must be a positive number')
        return
      }

      const unitsPerCarton = Number.parseInt(formState.initialBatch.unitsPerCarton, 10)
      if (!Number.isFinite(unitsPerCarton) || unitsPerCarton <= 0) {
        toast.error('Units per carton must be a positive number')
        return
      }

      const unitWeightKg = Number.parseFloat(formState.initialBatch.unitWeightKg)
      if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0) {
        toast.error('Unit weight (kg) must be a positive number')
        return
      }

      initialBatchPayload = {
        batchCode,
        packSize,
        unitsPerCarton,
        unitWeightKg,
        packagingType: formState.initialBatch.packagingType ? formState.initialBatch.packagingType : null,
      }
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        skuCode,
        asin: asinValue,
        description,
        defaultSupplierId: formState.defaultSupplierId ? formState.defaultSupplierId : null,
        secondarySupplierId: formState.secondarySupplierId ? formState.secondarySupplierId : null,
        category: categoryValue,
        sizeTier: sizeTierValue,
        referralFeePercent,
        fbaFulfillmentFee,
        itemSide1Cm,
        itemSide2Cm,
        itemSide3Cm,
        itemWeightKg,
      }

      if (initialBatchPayload) {
        payload.initialBatch = initialBatchPayload
      }

      let endpoint = '/api/skus'
      let method: 'POST' | 'PATCH' = 'POST'

      if (editingSku) {
        endpoint = `/api/skus?id=${encodeURIComponent(editingSku.id)}`
        method = 'PATCH'
      }

      const response = await fetchWithCSRF(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to save SKU')
      }

      toast.success(editingSku ? 'SKU updated' : 'SKU created')
      setIsModalOpen(false)
      setEditingSku(null)
      setFormState(buildFormState(null))
      onExternalModalClose?.()
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save SKU')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteSku = async (sku: SkuRow) => {
    try {
      const response = await fetchWithCSRF(`/api/skus?id=${encodeURIComponent(sku.id)}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to delete SKU')
      }

      toast.success(payload?.message ?? 'SKU deleted')
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete SKU')
    } finally {
      setConfirmDelete(null)
    }
  }

  const formatPackagingType = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    if (!trimmed) return null
    const normalized = trimmed.toUpperCase()
    if (normalized === 'BOX') return 'Box'
    if (normalized === 'POLYBAG') return 'Polybag'
    return trimmed
  }

  const formatBatchSummary = (batch: SkuBatchRow | undefined) => {
    if (!batch) return '—'

    const packSize = batch.packSize ? `Pack ${batch.packSize}` : null
    const unitsPerCarton = batch.unitsPerCarton ? `${batch.unitsPerCarton} units/ctn` : null
    const cartonsPerPallet =
      batch.storageCartonsPerPallet || batch.shippingCartonsPerPallet
        ? `Ctn/pallet S ${batch.storageCartonsPerPallet ?? '—'} • Ship ${batch.shippingCartonsPerPallet ?? '—'}`
        : null
    const packagingType = formatPackagingType(batch.packagingType)
    const unitWeightKg =
      typeof batch.unitWeightKg === 'number'
        ? `${batch.unitWeightKg.toFixed(3)} kg/unit`
        : batch.unitWeightKg
          ? `${batch.unitWeightKg} kg/unit`
          : null

    const summary = [packSize, unitsPerCarton, cartonsPerPallet, unitWeightKg, packagingType]
      .filter(Boolean)
      .join(' • ')

    if (summary) return summary
    return '—'
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Package2 className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-semibold text-slate-900">SKU Catalog</h2>
            </div>
            <p className="text-sm text-slate-600">Manage product SKUs and their specifications</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200 font-medium">
              {skus.length} SKUs
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-4 bg-slate-50/50 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search SKUs..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Package2 className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-base font-semibold text-slate-900">
                {searchTerm ? 'No SKUs found' : 'No SKUs yet'}
              </p>
              <p className="text-sm text-slate-500">
                {searchTerm
                  ? 'Clear your search or create a new SKU.'
                  : 'Create your first SKU to start receiving inventory.'}
              </p>
            </div>
            {!searchTerm && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                New SKU
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">ASIN</th>
                  <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell">
                    Latest Batch
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Txns</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkus.map(sku => {
                  const latestBatch = sku.batches?.[0]
                  const batchSummary = formatBatchSummary(latestBatch)

                  return (
                    <tr key={sku.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/config/products/batches?skuId=${encodeURIComponent(sku.id)}`
                              )
                            }
                            className="text-cyan-700 hover:underline"
                          >
                            {sku.skuCode}
                          </button>
                          <div className="text-xs text-slate-500 xl:hidden">{batchSummary}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {sku.description}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {sku.asin ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap hidden xl:table-cell">
                        <div className="space-y-1">
                          <div className="font-mono text-slate-700">
                            {latestBatch?.batchCode ?? '—'}
                          </div>
                          <div className="text-xs text-slate-500">{batchSummary}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {sku._count?.inventoryTransactions ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(sku)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmDelete(sku)}
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PortalModal open={isModalOpen} className="items-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingSku ? 'Edit SKU' : 'New SKU'}
            </h2>
            <div className="flex items-center gap-3">
              {editingSku ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeModal()
                    router.push(
                      `/config/products/batches?skuId=${encodeURIComponent(editingSku.id)}`
                    )
                  }}
                  disabled={isSubmitting}
                >
                  View Batches
                </Button>
              ) : null}
              <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Close
              </Button>
            </div>
          </div>

          <form onSubmit={submitSku} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="skuCode">SKU Code</Label>
                  <Input
                    id="skuCode"
                    value={formState.skuCode}
                    onChange={event =>
                      setFormState(prev => ({ ...prev, skuCode: event.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="asin">ASIN</Label>
                  <Input
                    id="asin"
                    value={formState.asin}
                    onChange={event =>
                      setFormState(prev => ({ ...prev, asin: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description</Label>
                    <span className={`text-xs ${formState.description.length > SKU_FIELD_LIMITS.DESCRIPTION_MAX ? 'text-red-500' : 'text-slate-400'}`}>
                      {formState.description.length}/{SKU_FIELD_LIMITS.DESCRIPTION_MAX}
                    </span>
                  </div>
                  <Input
                    id="description"
                    value={formState.description}
                    onChange={event =>
                      setFormState(prev => ({ ...prev, description: event.target.value }))
                    }
                    maxLength={SKU_FIELD_LIMITS.DESCRIPTION_MAX}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="defaultSupplierId">Default Supplier</Label>
                  <select
                    id="defaultSupplierId"
                    value={formState.defaultSupplierId}
                    onChange={event =>
                      setFormState(prev => ({ ...prev, defaultSupplierId: event.target.value }))
                    }
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={suppliersLoading}
                  >
                    <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="secondarySupplierId">Secondary Supplier</Label>
                  <select
                    id="secondarySupplierId"
                    value={formState.secondarySupplierId}
                    onChange={event =>
                      setFormState(prev => ({
                        ...prev,
                        secondarySupplierId: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={suppliersLoading}
                  >
                    <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amazon Fees Section */}
                <div className="md:col-span-2 pt-4 border-t">
                  <Tabs>
                    <TabsList className="w-full grid grid-cols-2 mb-4">
                      <TabsTrigger
                        type="button"
                        onClick={() => setModalTab('reference')}
                        data-state={modalTab === 'reference' ? 'active' : 'inactive'}
                      >
                        Reference
                      </TabsTrigger>
                      <TabsTrigger
                        type="button"
                        onClick={() => setModalTab('amazon')}
                        data-state={modalTab === 'amazon' ? 'active' : 'inactive'}
                      >
                        Amazon
                      </TabsTrigger>
                    </TabsList>

                    <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
                      <h4 className="text-sm font-semibold text-slate-900 mb-1">Amazon Fees & Unit Dimensions</h4>
                      <p className="text-xs text-slate-500 mb-3">
                        {modalTab === 'reference'
                          ? 'Team reference values (editable).'
                          : 'Imported from Amazon (read-only).'}
                      </p>
                      {modalTab === 'reference' ? (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="category">Category</Label>
                              <select
                                id="category"
                                value={formState.category}
                                onChange={event =>
                                  setFormState(prev => ({ ...prev, category: event.target.value }))
                                }
                                className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value="">Select category</option>
                                {AMAZON_REFERRAL_CATEGORIES_2026.map(category => (
                                  <option key={category} value={category}>
                                    {formatReferralCategoryLabel(category)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="sizeTier">Size Tier</Label>
                              <select
                                id="sizeTier"
                                value={formState.sizeTier}
                                onChange={event =>
                                  setFormState(prev => ({ ...prev, sizeTier: event.target.value }))
                                }
                                className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                              >
                                <option value="">Select size tier</option>
                                {AMAZON_SIZE_TIER_OPTIONS.map(sizeTier => (
                                  <option key={sizeTier} value={sizeTier}>
                                    {sizeTier}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="referralFeePercent">Referral Fee (%)</Label>
                              <Input
                                id="referralFeePercent"
                                type="number"
                                step="0.01"
                                min={0}
                                max={100}
                                value={formState.referralFeePercent}
                                onChange={event =>
                                  setFormState(prev => ({
                                    ...prev,
                                    referralFeePercent: event.target.value,
                                  }))
                                }
                                placeholder="e.g. 15"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="fbaFulfillmentFee">FBA Fulfillment Fee</Label>
                              <Input
                                id="fbaFulfillmentFee"
                                type="number"
                                step="0.01"
                                min={0}
                                value={formState.fbaFulfillmentFee}
                                onChange={event =>
                                  setFormState(prev => ({
                                    ...prev,
                                    fbaFulfillmentFee: event.target.value,
                                  }))
                                }
                                placeholder="e.g. 3.22"
                              />
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Unit Dimensions (cm)</Label>
                                <div className="grid grid-cols-3 gap-2">
                                  <Input
                                    id="itemSide1Cm"
                                    type="number"
                                    step="0.01"
                                    min={0.01}
                                    value={formState.itemSide1Cm}
                                    onChange={event =>
                                      setFormState(prev => ({ ...prev, itemSide1Cm: event.target.value }))
                                    }
                                    placeholder="L"
                                    inputMode="decimal"
                                  />
                                  <Input
                                    id="itemSide2Cm"
                                    type="number"
                                    step="0.01"
                                    min={0.01}
                                    value={formState.itemSide2Cm}
                                    onChange={event =>
                                      setFormState(prev => ({ ...prev, itemSide2Cm: event.target.value }))
                                    }
                                    placeholder="W"
                                    inputMode="decimal"
                                  />
                                  <Input
                                    id="itemSide3Cm"
                                    type="number"
                                    step="0.01"
                                    min={0.01}
                                    value={formState.itemSide3Cm}
                                    onChange={event =>
                                      setFormState(prev => ({ ...prev, itemSide3Cm: event.target.value }))
                                    }
                                    placeholder="H"
                                    inputMode="decimal"
                                  />
                                </div>
                                <p className="text-xs text-slate-500">Required for size-tier discrepancy checks.</p>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="itemWeightKg">Unit Weight (kg)</Label>
                                <Input
                                  id="itemWeightKg"
                                  type="number"
                                  step="0.001"
                                  min={0.001}
                                  value={formState.itemWeightKg}
                                  onChange={event =>
                                    setFormState(prev => ({ ...prev, itemWeightKg: event.target.value }))
                                  }
                                  placeholder="e.g. 0.29"
                                />
                                <p className="text-xs text-slate-500">Required for size-tier discrepancy checks.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Category</Label>
                              <Input
                                value={formState.amazonCategory}
                                disabled
                                className="bg-slate-100 text-slate-500"
                                placeholder="—"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Subcategory</Label>
                              <Input
                                value={formState.amazonSubcategory}
                                disabled
                                className="bg-slate-100 text-slate-500"
                                placeholder="—"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Size Tier</Label>
                              <Input
                                value={formState.amazonSizeTier}
                                disabled
                                className="bg-slate-100 text-slate-500"
                                placeholder="—"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Referral Fee (%)</Label>
                              <Input
                                value={formState.amazonReferralFeePercent}
                                disabled
                                className="bg-slate-100 text-slate-500"
                                placeholder="—"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>FBA Fulfillment Fee</Label>
                              <Input
                                value={formState.amazonFbaFulfillmentFee}
                                disabled
                                className="bg-slate-100 text-slate-500"
                                placeholder="—"
                              />
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Unit Dimensions (cm)</Label>
                                <Input
                                  value={formState.productDimensionsCm}
                                  disabled
                                  className="bg-slate-100 text-slate-500"
                                  placeholder="—"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Unit Weight (kg)</Label>
                                <Input
                                  value={formState.amazonReferenceWeightKg}
                                  disabled
                                  className="bg-slate-100 text-slate-500"
                                  placeholder="—"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Tabs>
                </div>

                {!editingSku ? (
                  <>
                    <div className="md:col-span-2 pt-2">
                      <h3 className="text-sm font-semibold text-slate-900">Initial Batch</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Required. Defines pack size, units/carton, and unit weight.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="initialBatchCode">Batch Code</Label>
                      <Input
                        id="initialBatchCode"
                        value={formState.initialBatch.batchCode}
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            initialBatch: { ...prev.initialBatch, batchCode: event.target.value },
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="initialPackagingType">Packaging Type</Label>
                      <select
                        id="initialPackagingType"
                        value={formState.initialBatch.packagingType}
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            initialBatch: {
                              ...prev.initialBatch,
                              packagingType: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Optional</option>
                        <option value="BOX">Box</option>
                        <option value="POLYBAG">Polybag</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="initialPackSize">Pack Size</Label>
                      <Input
                        id="initialPackSize"
                        type="number"
                        min={1}
                        value={formState.initialBatch.packSize}
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            initialBatch: { ...prev.initialBatch, packSize: event.target.value },
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="initialUnitsPerCarton">Units per Carton</Label>
                      <Input
                        id="initialUnitsPerCarton"
                        type="number"
                        min={1}
                        value={formState.initialBatch.unitsPerCarton}
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            initialBatch: {
                              ...prev.initialBatch,
                              unitsPerCarton: event.target.value,
                            },
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="initialUnitWeightKg">Unit Weight (kg)</Label>
                      <Input
                        id="initialUnitWeightKg"
                        type="number"
                        min={0.001}
                        step={0.001}
                        value={formState.initialBatch.unitWeightKg}
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            initialBatch: {
                              ...prev.initialBatch,
                              unitWeightKg: event.target.value,
                            },
                          }))
                        }
                        required
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <div />

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </PortalModal>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return
          void deleteSku(confirmDelete)
        }}
        title="Delete SKU?"
        message={
          confirmDelete
            ? `Delete ${confirmDelete.skuCode}? This is permanent and only allowed when there is no related history.`
            : ''
        }
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}
