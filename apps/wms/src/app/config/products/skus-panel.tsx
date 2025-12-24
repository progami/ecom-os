'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Edit2, Loader2, Package2, Plus, Search } from '@/lib/lucide-icons'
import { cn } from '@/lib/utils'
import { SkuBatchesModal } from './sku-batches-modal'

interface SkuRow {
  id: string
  skuCode: string
  description: string
  asin: string | null
  packSize: number | null
  defaultSupplierId?: string | null
  secondarySupplierId?: string | null
  material: string | null
  unitDimensionsCm: string | null
  unitLengthCm: number | string | null
  unitWidthCm: number | string | null
  unitHeightCm: number | string | null
  unitWeightKg: number | string | null
  unitsPerCarton: number
  cartonDimensionsCm: string | null
  cartonLengthCm: number | string | null
  cartonWidthCm: number | string | null
  cartonHeightCm: number | string | null
  cartonWeightKg: number | string | null
  packagingType: string | null
  isActive: boolean
  _count?: { inventoryTransactions: number }
}

interface SupplierOption {
  id: string
  name: string
  isActive: boolean
}

type DimensionParts = {
  length: string
  width: string
  height: string
}

type UnitSystem = 'metric' | 'imperial'

const UNIT_SYSTEM_STORAGE_KEY = 'wms:unit-system'
const CM_PER_INCH = 2.54
const LB_PER_KG = 2.2046226218

const EMPTY_DIMENSIONS: DimensionParts = { length: '', width: '', height: '' }

function parseDimensions(value: string | null | undefined): DimensionParts {
  if (!value) return EMPTY_DIMENSIONS
  const normalized = value.replace(/[×]/g, 'x')
  const matches = normalized.match(/(\d+(?:\.\d+)?)/g)
  if (!matches) return EMPTY_DIMENSIONS
  const [length, width, height] = matches
  return {
    length: length ?? '',
    width: width ?? '',
    height: height ?? '',
  }
}

function stripTrailingZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value
}

function formatNumber(value: number, decimals: number): string {
  return stripTrailingZeros(value.toFixed(decimals))
}

function convertNumericString(
  value: string,
  convert: (value: number) => number,
  decimals: number
): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return value
  return formatNumber(convert(parsed), decimals)
}

function convertDimensionValue(value: string, from: UnitSystem, to: UnitSystem): string {
  if (from === to) return value
  if (from === 'metric' && to === 'imperial') {
    return convertNumericString(value, num => num / CM_PER_INCH, 2)
  }
  return convertNumericString(value, num => num * CM_PER_INCH, 2)
}

function convertWeightValue(value: string, from: UnitSystem, to: UnitSystem): string {
  if (from === to) return value
  if (from === 'metric' && to === 'imperial') {
    return convertNumericString(value, num => num * LB_PER_KG, 3)
  }
  return convertNumericString(value, num => num / LB_PER_KG, 3)
}

function coerceFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const fallback = Number((value as { toString?: () => string })?.toString?.() ?? NaN)
  return Number.isFinite(fallback) ? fallback : null
}

type DimensionTripletCm = {
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

function resolveDimensionTripletCmFromSku(
  sku: SkuRow | null | undefined,
  kind: 'unit' | 'carton'
): DimensionTripletCm {
  if (!sku) {
    return { lengthCm: null, widthCm: null, heightCm: null }
  }

  const lengthValue =
    kind === 'unit' ? coerceFiniteNumber(sku.unitLengthCm) : coerceFiniteNumber(sku.cartonLengthCm)
  const widthValue =
    kind === 'unit' ? coerceFiniteNumber(sku.unitWidthCm) : coerceFiniteNumber(sku.cartonWidthCm)
  const heightValue =
    kind === 'unit' ? coerceFiniteNumber(sku.unitHeightCm) : coerceFiniteNumber(sku.cartonHeightCm)

  if (lengthValue !== null && widthValue !== null && heightValue !== null) {
    return { lengthCm: lengthValue, widthCm: widthValue, heightCm: heightValue }
  }

  const fallback = parseDimensions(kind === 'unit' ? sku.unitDimensionsCm : sku.cartonDimensionsCm)
  const parsed = [fallback.length, fallback.width, fallback.height].map(value => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numberValue = Number(trimmed)
    return Number.isFinite(numberValue) ? numberValue : null
  })

  if (parsed[0] === null || parsed[1] === null || parsed[2] === null) {
    return { lengthCm: null, widthCm: null, heightCm: null }
  }

  return { lengthCm: parsed[0], widthCm: parsed[1], heightCm: parsed[2] }
}

function formatDimensionFromCm(valueCm: number | null, unitSystem: UnitSystem): string {
  if (valueCm === null) return ''
  const resolved = unitSystem === 'imperial' ? valueCm / CM_PER_INCH : valueCm
  return formatNumber(resolved, 2)
}

function formatDimensionTripletDisplay(
  triplet: DimensionTripletCm,
  unitSystem: UnitSystem
): string {
  if (triplet.lengthCm === null || triplet.widthCm === null || triplet.heightCm === null) return '—'

  const convert = (valueCm: number) => (unitSystem === 'imperial' ? valueCm / CM_PER_INCH : valueCm)
  const length = formatNumber(convert(triplet.lengthCm), 2)
  const width = formatNumber(convert(triplet.widthCm), 2)
  const height = formatNumber(convert(triplet.heightCm), 2)
  return `${length}×${width}×${height}`
}

interface SkuFormState {
  skuCode: string
  description: string
  asin: string
  packSize: string
  defaultSupplierId: string
  secondarySupplierId: string
  material: string
  initialBatchCodes: string
  unitLength: string
  unitWidth: string
  unitHeight: string
  unitWeight: string
  unitsPerCarton: string
  cartonLength: string
  cartonWidth: string
  cartonHeight: string
  cartonWeight: string
  packagingType: string
  isActive: boolean
}

function buildFormState(sku?: SkuRow | null, unitSystem: UnitSystem = 'metric'): SkuFormState {
  const unitCm = resolveDimensionTripletCmFromSku(sku, 'unit')
  const cartonCm = resolveDimensionTripletCmFromSku(sku, 'carton')

  const unitWeight = coerceFiniteNumber(sku?.unitWeightKg)
  const cartonWeight = coerceFiniteNumber(sku?.cartonWeightKg)

  return {
    skuCode: sku?.skuCode ?? '',
    description: sku?.description ?? '',
    asin: sku?.asin ?? '',
    packSize: sku?.packSize?.toString() ?? '1',
    defaultSupplierId: sku?.defaultSupplierId ?? '',
    secondarySupplierId: sku?.secondarySupplierId ?? '',
    material: sku?.material ?? '',
    initialBatchCodes: '',
    unitLength: formatDimensionFromCm(unitCm.lengthCm, unitSystem),
    unitWidth: formatDimensionFromCm(unitCm.widthCm, unitSystem),
    unitHeight: formatDimensionFromCm(unitCm.heightCm, unitSystem),
    unitWeight:
      unitWeight === null
        ? ''
        : formatNumber(unitSystem === 'imperial' ? unitWeight * LB_PER_KG : unitWeight, 3),
    unitsPerCarton: sku?.unitsPerCarton?.toString() ?? '1',
    cartonLength: formatDimensionFromCm(cartonCm.lengthCm, unitSystem),
    cartonWidth: formatDimensionFromCm(cartonCm.widthCm, unitSystem),
    cartonHeight: formatDimensionFromCm(cartonCm.heightCm, unitSystem),
    cartonWeight:
      cartonWeight === null
        ? ''
        : formatNumber(unitSystem === 'imperial' ? cartonWeight * LB_PER_KG : cartonWeight, 3),
    packagingType: sku?.packagingType ?? '',
    isActive: sku?.isActive ?? true,
  }
}

function convertFormStateUnits(
  state: SkuFormState,
  from: UnitSystem,
  to: UnitSystem
): SkuFormState {
  if (from === to) return state

  return {
    ...state,
    unitLength: convertDimensionValue(state.unitLength, from, to),
    unitWidth: convertDimensionValue(state.unitWidth, from, to),
    unitHeight: convertDimensionValue(state.unitHeight, from, to),
    unitWeight: convertWeightValue(state.unitWeight, from, to),
    cartonLength: convertDimensionValue(state.cartonLength, from, to),
    cartonWidth: convertDimensionValue(state.cartonWidth, from, to),
    cartonHeight: convertDimensionValue(state.cartonHeight, from, to),
    cartonWeight: convertWeightValue(state.cartonWeight, from, to),
  }
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

interface SkusPanelProps {
  externalModalOpen?: boolean
  onExternalModalClose?: () => void
}

export default function SkusPanel({ externalModalOpen, onExternalModalClose }: SkusPanelProps) {
  const [skus, setSkus] = useState<SkuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [batchesSku, setBatchesSku] = useState<SkuRow | null>(null)

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSku, setEditingSku] = useState<SkuRow | null>(null)
  const [formState, setFormState] = useState<SkuFormState>(() => buildFormState())

  const [confirmToggle, setConfirmToggle] = useState<{
    sku: SkuRow
    nextActive: boolean
  } | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(UNIT_SYSTEM_STORAGE_KEY)
      if (saved === 'metric' || saved === 'imperial') {
        setUnitSystem(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  const applyUnitSystem = useCallback(
    (nextSystem: UnitSystem) => {
      setUnitSystem(prevSystem => {
        if (prevSystem === nextSystem) return prevSystem

        if (isModalOpen) {
          setFormState(prev => convertFormStateUnits(prev, prevSystem, nextSystem))
        }

        try {
          window.localStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, nextSystem)
        } catch {
          // ignore
        }

        return nextSystem
      })
    },
    [isModalOpen]
  )

  // Handle external modal open trigger
  useEffect(() => {
    if (externalModalOpen) {
      setEditingSku(null)
      setFormState(buildFormState(null, unitSystem))
      setIsModalOpen(true)
    }
  }, [externalModalOpen, unitSystem])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (showInactive) params.set('includeInactive', 'true')
    return params.toString()
  }, [searchTerm, showInactive])

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
      if (!showInactive && !sku.isActive) return false
      if (!term) return true

      return (
        sku.skuCode.toLowerCase().includes(term) ||
        sku.description.toLowerCase().includes(term) ||
        (sku.asin ?? '').toLowerCase().includes(term)
      )
    })
  }, [skus, searchTerm, showInactive])

  const totals = useMemo(() => {
    const active = skus.filter(s => s.isActive).length
    const inactive = skus.length - active
    return { active, inactive }
  }, [skus])

  const openCreate = () => {
    setEditingSku(null)
    setFormState(buildFormState(null, unitSystem))
    setIsModalOpen(true)
  }

  const openEdit = (sku: SkuRow) => {
    setEditingSku(sku)
    setFormState(buildFormState(sku, unitSystem))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setEditingSku(null)
    setFormState(buildFormState(null, unitSystem))
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

    const packSize = parsePositiveInt(formState.packSize)
    const unitsPerCarton = parsePositiveInt(formState.unitsPerCarton)
    if (!packSize) {
      toast.error('Pack size must be a positive integer')
      return
    }
    if (!unitsPerCarton) {
      toast.error('Units per carton must be a positive integer')
      return
    }

    const initialBatchCodes =
      editingSku === null
        ? formState.initialBatchCodes
            .split(/[,\\n]/g)
            .map(code => code.trim())
            .filter(Boolean)
        : []

    if (!editingSku) {
      if (initialBatchCodes.length === 0) {
        toast.error('At least one initial batch/lot code is required')
        return
      }

      const uniqueBatchCodes = new Set(initialBatchCodes.map(code => code.toLowerCase()))
      if (uniqueBatchCodes.size !== initialBatchCodes.length) {
        toast.error('Initial batch/lot codes must be unique')
        return
      }
    }

    const unitWeight = parseOptionalNumber(formState.unitWeight)
    if (unitWeight !== undefined && !parsePositiveNumber(formState.unitWeight)) {
      toast.error('Unit weight must be a positive number')
      return
    }

    const cartonWeight = parseOptionalNumber(formState.cartonWeight)
    if (cartonWeight !== undefined && !parsePositiveNumber(formState.cartonWeight)) {
      toast.error('Carton weight must be a positive number')
      return
    }

    const resolveWeightKg = (value: number) => {
      const normalized = unitSystem === 'imperial' ? value / LB_PER_KG : value
      return Number(normalized.toFixed(3))
    }

    const unitWeightKg = unitWeight === undefined ? undefined : resolveWeightKg(unitWeight)
    const cartonWeightKg = cartonWeight === undefined ? undefined : resolveWeightKg(cartonWeight)

    const buildDimensionTripletCm = (
      dims: DimensionParts,
      label: string
    ): { lengthCm: number; widthCm: number; heightCm: number } | null | undefined => {
      const parts = [dims.length.trim(), dims.width.trim(), dims.height.trim()]
      const any = parts.some(Boolean)
      if (!any) return null
      const all = parts.every(Boolean)
      if (!all) {
        toast.error(`${label} dimensions require L, W, and H`)
        return undefined
      }
      if (parts.some(part => parsePositiveNumber(part) === null)) {
        toast.error(`${label} dimensions must be positive numbers`)
        return undefined
      }

      const resolved = parts.map(part => {
        const value = Number(part)
        const normalizedCm = unitSystem === 'imperial' ? value * CM_PER_INCH : value
        return Number(normalizedCm.toFixed(2))
      })

      return { lengthCm: resolved[0], widthCm: resolved[1], heightCm: resolved[2] }
    }

    const unitDimensions = buildDimensionTripletCm(
      { length: formState.unitLength, width: formState.unitWidth, height: formState.unitHeight },
      'Unit'
    )
    if (unitDimensions === undefined) return

    const cartonDimensions = buildDimensionTripletCm(
      {
        length: formState.cartonLength,
        width: formState.cartonWidth,
        height: formState.cartonHeight,
      },
      'Carton'
    )
    if (cartonDimensions === undefined) return

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        skuCode: formState.skuCode.trim(),
        asin: formState.asin.trim() ? formState.asin.trim() : null,
        description: formState.description.trim(),
        packSize,
        defaultSupplierId: formState.defaultSupplierId ? formState.defaultSupplierId : null,
        secondarySupplierId: formState.secondarySupplierId ? formState.secondarySupplierId : null,
        material: formState.material.trim() ? formState.material.trim() : null,
        unitLengthCm: unitDimensions ? unitDimensions.lengthCm : null,
        unitWidthCm: unitDimensions ? unitDimensions.widthCm : null,
        unitHeightCm: unitDimensions ? unitDimensions.heightCm : null,
        unitWeightKg: unitWeightKg ?? null,
        unitsPerCarton,
        cartonLengthCm: cartonDimensions ? cartonDimensions.lengthCm : null,
        cartonWidthCm: cartonDimensions ? cartonDimensions.widthCm : null,
        cartonHeightCm: cartonDimensions ? cartonDimensions.heightCm : null,
        cartonWeightKg: cartonWeightKg ?? null,
        packagingType: formState.packagingType.trim() ? formState.packagingType.trim() : null,
        isActive: formState.isActive,
      }

      if (!editingSku) {
        payload.initialBatchCodes = initialBatchCodes
      }

      const endpoint = editingSku
        ? `/api/skus?id=${encodeURIComponent(editingSku.id)}`
        : '/api/skus'
      const method = editingSku ? 'PATCH' : 'POST'
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
      setFormState(buildFormState(null, unitSystem))
      onExternalModalClose?.()
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save SKU')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSkuActive = async (sku: SkuRow, nextActive: boolean) => {
    try {
      const response = await fetchWithCSRF(`/api/skus?id=${encodeURIComponent(sku.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update SKU')
      }

      toast.success(nextActive ? 'SKU activated' : 'SKU deactivated')
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update SKU')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Package2 className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-semibold text-slate-900">SKU Catalog</h2>
            </div>
            <p className="text-sm text-slate-600">Manage product SKUs and their specifications</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
              {totals.active} active
            </Badge>
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium">
              {totals.inactive} inactive
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
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={event => setShowInactive(event.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              Show inactive
            </label>
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
                {searchTerm || showInactive ? 'No SKUs found' : 'No SKUs yet'}
              </p>
              <p className="text-sm text-slate-500">
                {searchTerm
                  ? 'Clear your search or create a new SKU.'
                  : 'Create your first SKU to start receiving inventory.'}
              </p>
            </div>
            {!searchTerm && !showInactive && (
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
                  <th className="px-4 py-3 text-right font-semibold">Item Dims (cm)</th>
                  <th className="px-4 py-3 text-right font-semibold">Carton Dims (cm)</th>
                  <th className="px-4 py-3 text-right font-semibold">Pack</th>
                  <th className="px-4 py-3 text-right font-semibold">Units/Carton</th>
                  <th className="px-4 py-3 text-right font-semibold">Txns</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkus.map(sku => {
                  const unitDims = resolveDimensionTripletCmFromSku(sku, 'unit')
                  const cartonDims = resolveDimensionTripletCmFromSku(sku, 'carton')

                  return (
                    <tr key={sku.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {sku.skuCode}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {sku.description}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {sku.asin ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {formatDimensionTripletDisplay(unitDims, 'metric')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {formatDimensionTripletDisplay(cartonDims, 'metric')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {sku.packSize ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {sku.unitsPerCarton}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {sku._count?.inventoryTransactions ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={
                            sku.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }
                        >
                          {sku.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setBatchesSku(sku)}>
                            Batches
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(sku)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmToggle({ sku, nextActive: !sku.isActive })}
                          >
                            {sku.isActive ? 'Deactivate' : 'Activate'}
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

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="flex h-full w-full items-start justify-center overflow-y-auto p-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingSku ? 'Edit SKU' : 'New SKU'}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => applyUnitSystem('metric')}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        unitSystem === 'metric'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                      aria-pressed={unitSystem === 'metric'}
                    >
                      cm/kg
                    </button>
                    <button
                      type="button"
                      onClick={() => applyUnitSystem('imperial')}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        unitSystem === 'imperial'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                      aria-pressed={unitSystem === 'imperial'}
                    >
                      in/lb
                    </button>
                  </div>
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
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formState.description}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, description: event.target.value }))
                        }
                        required
                      />
                    </div>

                    {!editingSku ? (
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="initialBatchCodes">Initial Batch/Lot</Label>
                        <Input
                          id="initialBatchCodes"
                          value={formState.initialBatchCodes}
                          onChange={event =>
                            setFormState(prev => ({
                              ...prev,
                              initialBatchCodes: event.target.value,
                            }))
                          }
                          placeholder="Required (comma or newline separated)"
                          required
                        />
                        <p className="text-xs text-slate-500">
                          Example: <span className="font-medium">BATCH001</span> or{' '}
                          <span className="font-medium">BATCH001, BATCH002</span>
                        </p>
                      </div>
                    ) : null}

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
                        {suppliers
                          .filter(supplier => supplier.isActive)
                          .map(supplier => (
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
                        {suppliers
                          .filter(supplier => supplier.isActive)
                          .map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="packSize">Pack Size</Label>
                      <Input
                        id="packSize"
                        type="number"
                        min={1}
                        value={formState.packSize}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, packSize: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="unitsPerCarton">Units per Carton</Label>
                      <Input
                        id="unitsPerCarton"
                        type="number"
                        min={1}
                        value={formState.unitsPerCarton}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, unitsPerCarton: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="material">Material</Label>
                      <Input
                        id="material"
                        value={formState.material}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, material: event.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="packagingType">Packaging Type</Label>
                      <Input
                        id="packagingType"
                        value={formState.packagingType}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, packagingType: event.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label>Unit Dimensions ({unitSystem === 'metric' ? 'cm' : 'in'})</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={formState.unitLength}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, unitLength: event.target.value }))
                          }
                          placeholder="L"
                          inputMode="decimal"
                        />
                        <Input
                          value={formState.unitWidth}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, unitWidth: event.target.value }))
                          }
                          placeholder="W"
                          inputMode="decimal"
                        />
                        <Input
                          value={formState.unitHeight}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, unitHeight: event.target.value }))
                          }
                          placeholder="H"
                          inputMode="decimal"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="unitWeight">
                        Unit Weight ({unitSystem === 'metric' ? 'kg' : 'lb'})
                      </Label>
                      <Input
                        id="unitWeight"
                        type="number"
                        step="0.001"
                        min={0.001}
                        value={formState.unitWeight}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, unitWeight: event.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label>Carton Dimensions ({unitSystem === 'metric' ? 'cm' : 'in'})</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={formState.cartonLength}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, cartonLength: event.target.value }))
                          }
                          placeholder="L"
                          inputMode="decimal"
                        />
                        <Input
                          value={formState.cartonWidth}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, cartonWidth: event.target.value }))
                          }
                          placeholder="W"
                          inputMode="decimal"
                        />
                        <Input
                          value={formState.cartonHeight}
                          onChange={event =>
                            setFormState(prev => ({ ...prev, cartonHeight: event.target.value }))
                          }
                          placeholder="H"
                          inputMode="decimal"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="cartonWeight">
                        Carton Weight ({unitSystem === 'metric' ? 'kg' : 'lb'})
                      </Label>
                      <Input
                        id="cartonWeight"
                        type="number"
                        step="0.001"
                        min={0.001}
                        value={formState.cartonWeight}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, cartonWeight: event.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={event =>
                        setFormState(prev => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Active
                  </label>

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
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmToggle !== null}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => {
          if (!confirmToggle) return
          void toggleSkuActive(confirmToggle.sku, confirmToggle.nextActive)
        }}
        title={confirmToggle?.nextActive ? 'Activate SKU?' : 'Deactivate SKU?'}
        message={
          confirmToggle
            ? `${confirmToggle.nextActive ? 'Activate' : 'Deactivate'} ${confirmToggle.sku.skuCode}?`
            : ''
        }
        confirmText={confirmToggle?.nextActive ? 'Activate' : 'Deactivate'}
        type={confirmToggle?.nextActive ? 'info' : 'warning'}
      />

      <SkuBatchesModal
        isOpen={batchesSku !== null}
        onClose={() => setBatchesSku(null)}
        sku={
          batchesSku
            ? {
                id: batchesSku.id,
                skuCode: batchesSku.skuCode,
                description: batchesSku.description,
              }
            : null
        }
      />
    </div>
  )
}
