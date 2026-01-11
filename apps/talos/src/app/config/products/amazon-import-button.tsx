'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { PortalModal } from '@/components/ui/portal-modal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Cloud, Loader2, Search, X } from '@/lib/lucide-icons'

type ImportResult = {
  imported: number
  skipped: number
  errors: string[]
  details?: Array<{
    skuCode: string
    status: 'imported' | 'skipped' | 'blocked'
    message?: string
    unitWeightKg?: number | null
    unitDimensionsCm?: string | null
  }>
}

type ImportPreview = {
  limit: number
  totalListings: number
  hasMore: boolean
  summary: {
    newCount: number
    existingCount: number
    blockedCount: number
  }
  policy: {
    updatesExistingSkus: boolean
    createsBatch: boolean
    defaultBatchCode: string
  }
  items: Array<{
    sellerSku: string
    skuCode: string | null
    asin: string | null
    title: string | null
    status: 'new' | 'existing' | 'blocked'
    reason: string | null
    exists: boolean
  }>
}

export function AmazonImportButton({ onImportComplete }: { onImportComplete?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'new' | 'existing' | 'blocked'>('new')
  const [selectedSkuCodes, setSelectedSkuCodes] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validatedKey, setValidatedKey] = useState<string | null>(null)
  const [validation, setValidation] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleClose = () => {
    setIsOpen(false)
    setPreview(null)
    setPreviewError(null)
    setSearch('')
    setFilter('new')
    setSelectedSkuCodes(new Set())
    setValidation(null)
    setValidatedKey(null)
    setResult(null)
    setImporting(false)
    setValidating(false)
  }

  const selectionKey = useMemo(() => {
    const sorted = Array.from(selectedSkuCodes).sort((a, b) => a.localeCompare(b))
    return sorted.join('|')
  }, [selectedSkuCodes])

  const validationBySku = useMemo(() => {
    if (!validation?.details) return new Map<string, NonNullable<ImportResult['details']>[number]>()
    return new Map(validation.details.map(detail => [detail.skuCode.toUpperCase(), detail]))
  }, [validation])

  const selectableItems = useMemo(() => {
    if (!preview) return []
    return preview.items.filter(item => item.status === 'new' && item.skuCode)
  }, [preview])

  const filteredItems = useMemo(() => {
    if (!preview) return []
    const normalizedSearch = search.trim().toLowerCase()
    return preview.items.filter(item => {
      if (filter !== 'all' && item.status !== filter) return false
      if (!normalizedSearch) return true
      const haystack = [
        item.sellerSku,
        item.skuCode ?? '',
        item.asin ?? '',
        item.title ?? '',
        item.reason ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [filter, preview, search])

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    setPreview(null)
    setPreviewError(null)
    setSelectedSkuCodes(new Set())
    setValidation(null)
    setValidatedKey(null)

    try {
      const response = await fetch('/api/amazon/import-skus?limit=250', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Failed to load Amazon listings'
        throw new Error(message)
      }

      const nextPreview = payload?.preview as ImportPreview | undefined
      if (!nextPreview) {
        throw new Error('Unexpected response from Amazon preview')
      }

      setPreview(nextPreview)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Amazon listings'
      setPreviewError(message)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    loadPreview()
  }, [isOpen, loadPreview])

  const toggleSkuCode = (skuCode: string) => {
    setSelectedSkuCodes(prev => {
      const next = new Set(prev)
      const key = skuCode.toUpperCase()
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setValidation(null)
    setValidatedKey(null)
    setResult(null)
  }

  const selectAllNew = () => {
    const next = new Set<string>()
    for (const item of selectableItems) {
      if (item.skuCode) next.add(item.skuCode.toUpperCase())
    }
    setSelectedSkuCodes(next)
    setValidation(null)
    setValidatedKey(null)
    setResult(null)
  }

  const clearSelection = () => {
    setSelectedSkuCodes(new Set())
    setValidation(null)
    setValidatedKey(null)
    setResult(null)
  }

  const validateSelection = async () => {
    if (selectedSkuCodes.size === 0) return

    setValidating(true)
    setValidation(null)
    setValidatedKey(null)

    try {
      const response = await fetch('/api/amazon/import-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuCodes: Array.from(selectedSkuCodes), mode: 'validate' }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim() ? payload.error : 'Validation failed'
        throw new Error(message)
      }

      const nextResult = payload?.result as ImportResult | undefined
      if (!nextResult) {
        throw new Error('Unexpected response from Amazon validation')
      }

      setValidation(nextResult)
      setValidatedKey(selectionKey)

      const blocked = nextResult.details?.filter(detail => detail.status !== 'imported') ?? []
      if (blocked.length === 0) {
        toast.success('Validation passed')
      } else {
        toast.error('Some SKUs failed validation (deselect them to continue)')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation failed')
      setValidation({
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      })
    } finally {
      setValidating(false)
    }
  }

  const canImport = useMemo(() => {
    if (importing || validating) return false
    if (selectedSkuCodes.size === 0) return false
    if (!validation || validatedKey !== selectionKey) return false

    for (const skuCode of selectedSkuCodes) {
      const detail = validationBySku.get(skuCode.toUpperCase())
      if (!detail || detail.status !== 'imported') return false
    }

    return true
  }, [importing, validating, selectedSkuCodes, validation, validatedKey, selectionKey, validationBySku])

  const handleImport = async () => {
    if (!canImport) return
    setImporting(true)
    setResult(null)

    try {
      const response = await fetch('/api/amazon/import-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuCodes: Array.from(selectedSkuCodes), mode: 'import' }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Failed to import from Amazon'
        throw new Error(message)
      }

      const nextResult = payload?.result as ImportResult | undefined
      if (!nextResult) {
        throw new Error('Unexpected response from Amazon import')
      }

      setResult(nextResult)
      toast.success(`Imported ${nextResult.imported} SKU${nextResult.imported === 1 ? '' : 's'}`)
      onImportComplete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import from Amazon')
      setResult({
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Failed to import from Amazon'],
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline" className="gap-2">
        <Cloud className="h-4 w-4" />
        Import from Amazon
      </Button>

      <PortalModal open={isOpen} className="items-center">
        <div className="flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-lg font-semibold text-slate-900">Import Products from Amazon</h3>
              <p className="text-xs text-slate-500">
                Preview → validate → import (existing SKUs are never updated).
              </p>
            </div>
            <Button onClick={handleClose} variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                <div className="font-medium">Safe import rules</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-cyan-900/80">
                  <li>Existing SKUs are skipped (no overwrites).</li>
                  <li>Each selected SKU is validated (ASIN + unit weight required) before import.</li>
                  <li>
                    A default batch (<span className="font-mono">{preview?.policy.defaultBatchCode ?? 'BATCH 01'}</span>)
                    is created for each new SKU.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border bg-white p-3 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">Preview</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadPreview}
                    disabled={loadingPreview || importing || validating}
                  >
                    Refresh
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-slate-500">New</div>
                    <div className="font-semibold text-emerald-700">{preview?.summary.newCount ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Existing</div>
                    <div className="font-semibold text-slate-800">{preview?.summary.existingCount ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Blocked</div>
                    <div className="font-semibold text-rose-700">{preview?.summary.blockedCount ?? '—'}</div>
                  </div>
                </div>
                {preview?.hasMore ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Amazon has more listings; showing the first {preview.limit}.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search SKU, ASIN, title…"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={filter === 'new' ? 'default' : 'outline'}
                    onClick={() => setFilter('new')}
                  >
                    New
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filter === 'existing' ? 'default' : 'outline'}
                    onClick={() => setFilter('existing')}
                  >
                    Existing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filter === 'blocked' ? 'default' : 'outline'}
                    onClick={() => setFilter('blocked')}
                  >
                    Blocked
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filter === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilter('all')}
                  >
                    All
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllNew}
                  disabled={!preview || importing || validating || loadingPreview}
                >
                  Select all new
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedSkuCodes.size === 0 || importing || validating}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="max-h-[42vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="w-10 px-3 py-2"> </th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">ASIN</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPreview ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading Amazon listings…
                          </span>
                        </td>
                      </tr>
                    ) : previewError ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-rose-700">
                          {previewError}
                        </td>
                      </tr>
                    ) : !preview || preview.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          No listings found.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map(item => {
                        const skuKey = item.skuCode?.toUpperCase() ?? null
                        const isSelectable = item.status === 'new' && Boolean(skuKey)
                        const checked = skuKey ? selectedSkuCodes.has(skuKey) : false
                        const validationDetail = skuKey ? validationBySku.get(skuKey) : undefined
                        const validationStatus = validationDetail?.status

                        return (
                          <tr key={`${item.sellerSku}-${item.asin ?? ''}`} className="border-b last:border-b-0">
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-cyan-600"
                                disabled={!isSelectable || importing || validating}
                                checked={checked}
                                onChange={() => skuKey && toggleSkuCode(skuKey)}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-slate-900">{item.skuCode ?? '—'}</div>
                              <div className="text-xs text-slate-500">Amazon: {item.sellerSku}</div>
                              {validationDetail?.unitWeightKg ? (
                                <div className="mt-1 text-xs text-slate-600">
                                  Unit: {validationDetail.unitWeightKg.toFixed(3)} kg
                                  {validationDetail.unitDimensionsCm ? ` • ${validationDetail.unitDimensionsCm}` : ''}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">
                              {item.asin ?? '—'}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-700">{item.title ?? '—'}</div>
                              {item.reason ? (
                                <div className="mt-1 text-xs text-slate-500">{item.reason}</div>
                              ) : null}
                              {validationStatus && validationStatus !== 'imported' ? (
                                <div className="mt-1 text-xs text-rose-700">
                                  {validationDetail?.message ?? 'Failed validation'}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {item.status === 'new' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  New
                                </Badge>
                              ) : item.status === 'existing' ? (
                                <Badge variant="secondary">Existing</Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                                  Blocked
                                </Badge>
                              )}
                              {validatedKey === selectionKey && checked ? (
                                <div className="mt-2 text-xs text-slate-500">
                                  {validationStatus === 'imported' ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700">
                                      <CheckCircle className="h-3.5 w-3.5" /> Valid
                                    </span>
                                  ) : validationStatus ? (
                                    <span className="inline-flex items-center gap-1 text-rose-700">
                                      <AlertCircle className="h-3.5 w-3.5" /> Blocked
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {result ? (
              <div className="mt-4 rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">Import Results</h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      result.errors.length === 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {result.errors.length === 0 ? (
                      <>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Success
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Partial
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Imported:</span>{' '}
                    <span className="font-medium">{result.imported}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Skipped:</span>{' '}
                    <span className="font-medium">{result.skipped}</span>
                  </div>
                </div>

                {result.errors.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-slate-700">Notes</p>
                    <ul className="max-h-32 space-y-1 overflow-auto text-xs text-slate-600">
                      {result.errors.map((error, idx) => (
                        <li key={`${error}-${idx}`} className="flex gap-2">
                          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Selected:{' '}
              <span className="font-semibold text-slate-900">{selectedSkuCodes.size}</span>
              {validatedKey === selectionKey && validation ? (
                <span className="ml-2 text-slate-500">
                  • Valid:{' '}
                  <span className="font-semibold text-emerald-700">{validation.imported}</span>
                </span>
              ) : null}
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={handleClose} variant="outline" disabled={importing || validating}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={validateSelection}
                disabled={selectedSkuCodes.size === 0 || validating || importing}
                className="gap-2"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {validating ? 'Validating…' : 'Validate'}
              </Button>
              <Button onClick={handleImport} disabled={!canImport} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      </PortalModal>
    </>
  )
}
