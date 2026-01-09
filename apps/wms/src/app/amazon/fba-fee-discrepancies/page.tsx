'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/usePortalSession'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer, PageContent, PageHeaderSection } from '@/components/layout/page-container'
import { DollarSign, Loader2, Search } from '@/lib/lucide-icons'

type AlertStatus =
  | 'UNKNOWN'
  | 'MATCH'
  | 'MISMATCH'
  | 'NO_ASIN'
  | 'MISSING_REFERENCE'
  | 'ERROR'

type ApiAlert = {
  status: AlertStatus
  message: string | null
  checkedAt: string | null
  currencyCode: string | null
  listingPrice: number | string | null
  referenceSizeTier: string | null
  referenceFbaFulfillmentFee: number | string | null
  amazonFbaFulfillmentFee: number | string | null
}

type ApiSkuRow = {
  id: string
  skuCode: string
  description: string
  asin: string | null
  amazonCategory: string | null
  amazonSizeTier: string | null
  amazonReferralFeePercent: number | string | null
  amazonFbaFulfillmentFee: number | string | null
  amazonFbaFeeAlert: ApiAlert | null
}

const ALLOWED_ROLES = ['admin', 'staff'] as const

function formatMoney(value: number | string | null | undefined, currencyCode: string | null) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(amount)) return '—'
  return `${currencyCode ?? ''}${currencyCode ? ' ' : ''}${amount.toFixed(2)}`
}

function statusBadge(status: AlertStatus) {
  switch (status) {
    case 'MATCH':
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Match</Badge>
    case 'MISMATCH':
      return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Mismatch</Badge>
    case 'NO_ASIN':
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Missing ASIN</Badge>
    case 'MISSING_REFERENCE':
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200">Missing reference</Badge>
      )
    case 'ERROR':
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Error</Badge>
    case 'UNKNOWN':
    default:
      return <Badge className="bg-slate-50 text-slate-700 border-slate-200">Not checked</Badge>
  }
}

export default function AmazonFbaFeeDiscrepanciesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(false)
  const [skus, setSkus] = useState<ApiSkuRow[]>([])
  const [currencyCode, setCurrencyCode] = useState<string>('USD')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL')
  const [listingPrice, setListingPrice] = useState('10')
  const [checkingSkuId, setCheckingSkuId] = useState<string | null>(null)

  const isAllowed = useMemo(() => {
    if (!session) return false
    type AllowedRole = (typeof ALLOWED_ROLES)[number]
    return ALLOWED_ROLES.includes(session.user.role as AllowedRole)
  }, [session])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      redirectToPortal('/login', `${window.location.origin}${basePath}/amazon/fba-fee-discrepancies`)
      return
    }

    if (!isAllowed) {
      toast.error('You are not authorised to view this page')
      router.push('/dashboard')
    }
  }, [isAllowed, router, session, status])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const response = await fetch(`/api/amazon/fba-fee-discrepancies?${params.toString()}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load fee discrepancies')
      }

      const payload = await response.json()
      setCurrencyCode(payload?.currencyCode ?? 'USD')
      setSkus(Array.isArray(payload?.skus) ? payload.skus : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load fee discrepancies')
      setSkus([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    if (status !== 'loading' && session && isAllowed) {
      void fetchRows()
    }
  }, [fetchRows, isAllowed, session, status])

  const summary = useMemo(() => {
    const counts: Record<string, number> = {
      total: skus.length,
      mismatch: 0,
      match: 0,
      missingReference: 0,
      missingAsin: 0,
      error: 0,
      notChecked: 0,
    }

    for (const sku of skus) {
      const status = sku.amazonFbaFeeAlert?.status ?? 'UNKNOWN'
      if (status === 'MISMATCH') counts.mismatch += 1
      else if (status === 'MATCH') counts.match += 1
      else if (status === 'MISSING_REFERENCE') counts.missingReference += 1
      else if (status === 'NO_ASIN') counts.missingAsin += 1
      else if (status === 'ERROR') counts.error += 1
      else counts.notChecked += 1
    }

    return counts
  }, [skus])

  const checkSku = useCallback(
    async (sku: ApiSkuRow) => {
      if (checkingSkuId) return

      const parsedListingPrice = listingPrice.trim()
        ? Number.parseFloat(listingPrice.trim())
        : Number.NaN
      if (!Number.isFinite(parsedListingPrice) || parsedListingPrice <= 0) {
        toast.error('Listing price must be a positive number')
        return
      }

      setCheckingSkuId(sku.id)
      try {
        const response = await fetchWithCSRF('/api/amazon/fba-fee-discrepancies', {
          method: 'POST',
          body: JSON.stringify({
            skuId: sku.id,
            listingPrice: parsedListingPrice,
          }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Fee check failed')
        }

        const updatedAlert = await response.json()
        setSkus(prev =>
          prev.map(row =>
            row.id === sku.id ? { ...row, amazonFbaFeeAlert: updatedAlert } : row
          )
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Fee check failed')
      } finally {
        setCheckingSkuId(null)
      }
    },
    [checkingSkuId, listingPrice]
  )

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent " />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (!session || !isAllowed) return null

  return (
    <PageContainer>
      <PageHeaderSection
        title="FBA Fee Discrepancies"
        description="Amazon"
        icon={DollarSign}
        metadata={
          <>
            <Badge className="bg-slate-50 text-slate-700 border-slate-200">
              Currency: {currencyCode}
            </Badge>
            <Badge className="bg-rose-50 text-rose-700 border-rose-200">
              {summary.mismatch} mismatches
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {summary.match} matches
            </Badge>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fetchRows()} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </span>
              ) : (
                'Reload'
              )}
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-6">
        <div className="rounded-xl border bg-white shadow-soft">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900">Reference vs Amazon</h2>
                <p className="text-sm text-slate-600">
                  Reference values come from SKU defaults. Edit them in{' '}
                  <Link href="/config/products" className="text-cyan-700 hover:underline">
                    Products
                  </Link>
                  .
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="search"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="SKU, ASIN, description…"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="statusFilter">Status</Label>
                  <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value as AlertStatus | 'ALL')}
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="ALL">All</option>
                    <option value="MISMATCH">Mismatch</option>
                    <option value="MATCH">Match</option>
                    <option value="MISSING_REFERENCE">Missing reference</option>
                    <option value="NO_ASIN">Missing ASIN</option>
                    <option value="ERROR">Error</option>
                    <option value="UNKNOWN">Not checked</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="listingPrice">Listing Price</Label>
                  <Input
                    id="listingPrice"
                    value={listingPrice}
                    onChange={event => setListingPrice(event.target.value)}
                    placeholder="Used for Amazon fee estimate"
                    inputMode="decimal"
                  />
                  <p className="text-[11px] text-slate-500">
                    Used only to query Amazon. FBA fulfillment fee should be price-independent.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : skus.length === 0 ? (
            <div className="px-6 py-12">
              <EmptyState
                title="No SKUs found"
                description="Try adjusting your search or filter."
                icon={DollarSign}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold">Amazon</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skus.map(row => {
                    const alert = row.amazonFbaFeeAlert
                    const status: AlertStatus = alert?.status ?? 'UNKNOWN'
                    const resolvedCurrency = alert?.currencyCode ?? currencyCode

                    const referenceFee = row.amazonFbaFulfillmentFee
                    const referenceSize = row.amazonSizeTier

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-900">{row.skuCode}</div>
                            <div className="text-xs text-slate-500">
                              {row.description}
                              {row.asin ? (
                                <>
                                  {' '}
                                  • <span className="font-mono">{row.asin}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="font-medium">
                              {formatMoney(referenceFee, resolvedCurrency)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {referenceSize ? `Size tier: ${referenceSize}` : 'Size tier: —'}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="font-medium">
                              {formatMoney(alert?.amazonFbaFulfillmentFee ?? null, resolvedCurrency)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {alert?.checkedAt
                                ? `Checked ${new Date(alert.checkedAt).toLocaleString()}`
                                : 'Not checked yet'}
                            </div>
                            {alert?.message ? (
                              <div className="text-[11px] text-slate-500">{alert.message}</div>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">{statusBadge(status)}</td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => checkSku(row)}
                            disabled={checkingSkuId !== null}
                          >
                            {checkingSkuId === row.id ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Checking…
                              </span>
                            ) : (
                              'Check'
                            )}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContent>
    </PageContainer>
  )
}
