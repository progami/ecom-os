'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/usePortalSession'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer, PageContent, PageHeaderSection } from '@/components/layout/page-container'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from '@/lib/lucide-icons'

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
  latestBatchCode?: string | null
  amazonFbaFeeAlert: ApiAlert | null
}

const ALLOWED_ROLES = ['admin', 'staff'] as const

function formatFee(value: number | string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function StatusIcon({ status }: { status: AlertStatus }) {
  switch (status) {
    case 'MATCH':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'MISMATCH':
      return <XCircle className="h-4 w-4 text-rose-500" />
    case 'NO_ASIN':
    case 'MISSING_REFERENCE':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    case 'ERROR':
      return <XCircle className="h-4 w-4 text-slate-400" />
    default:
      return <Clock className="h-4 w-4 text-slate-300" />
  }
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const config = {
    MATCH: { label: 'Match', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    MISMATCH: { label: 'Mismatch', className: 'bg-rose-500/10 text-rose-700 border-rose-500/20' },
    NO_ASIN: { label: 'No ASIN', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    MISSING_REFERENCE: { label: 'No Ref', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    ERROR: { label: 'Error', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
    UNKNOWN: { label: 'Pending', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      <StatusIcon status={status} />
      {config.label}
    </span>
  )
}

function SummaryCard({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: 'danger' | 'success' | 'warning' | 'neutral'
}) {
  const styles = {
    danger: 'bg-rose-50 border-rose-100 text-rose-900',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    warning: 'bg-amber-50 border-amber-100 text-amber-900',
    neutral: 'bg-slate-50 border-slate-100 text-slate-900',
  }[variant]

  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <div className="text-2xl font-semibold tabular-nums">{count}</div>
      <div className="text-xs font-medium opacity-70">{label}</div>
    </div>
  )
}

export default function AmazonFbaFeeDiscrepanciesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(false)
  const [skus, setSkus] = useState<ApiSkuRow[]>([])
  const [currencyCode, setCurrencyCode] = useState<string>('USD')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL')
  const [listingPrice] = useState('10')
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
    const counts = { total: skus.length, mismatch: 0, match: 0, warning: 0, pending: 0 }

    for (const sku of skus) {
      const s = sku.amazonFbaFeeAlert?.status ?? 'UNKNOWN'
      if (s === 'MISMATCH') counts.mismatch += 1
      else if (s === 'MATCH') counts.match += 1
      else if (s === 'NO_ASIN' || s === 'MISSING_REFERENCE' || s === 'ERROR') counts.warning += 1
      else counts.pending += 1
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
        toast.success(`Checked ${sku.skuCode}`)
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <span className="text-sm text-slate-500">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session || !isAllowed) return null

  return (
    <PageContainer>
      <PageHeaderSection
        title="FBA Fee Discrepancies"
        description="Compare reference fees against Amazon"
        icon={DollarSign}
        actions={
          <Button variant="outline" size="sm" onClick={() => fetchRows()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <PageContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Mismatches" count={summary.mismatch} variant="danger" />
          <SummaryCard label="Matches" count={summary.match} variant="success" />
          <SummaryCard label="Warnings" count={summary.warning} variant="warning" />
          <SummaryCard label="Pending" count={summary.pending} variant="neutral" />
        </div>

        {/* Main Content */}
        <div className="rounded-xl border bg-white shadow-soft overflow-hidden">
          {/* Filters */}
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search SKU or ASIN..."
                  className="w-64 pl-9 h-9 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as AlertStatus | 'ALL')}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              >
                <option value="ALL">All statuses</option>
                <option value="MISMATCH">Mismatch</option>
                <option value="MATCH">Match</option>
                <option value="MISSING_REFERENCE">Missing reference</option>
                <option value="NO_ASIN">No ASIN</option>
                <option value="UNKNOWN">Pending</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Reference values from latest batch ·{' '}
              <Link href="/config/products" className="text-cyan-600 hover:underline">
                Products → Batches
              </Link>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : skus.length === 0 ? (
            <div className="px-6 py-16">
              <EmptyState
                title="No SKUs found"
                description="Try adjusting your search or filter."
                icon={DollarSign}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">ASIN</th>
                    <th className="px-4 py-3 text-right">Reference</th>
                    <th className="px-4 py-3 text-center w-8"></th>
                    <th className="px-4 py-3 text-right">Amazon</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skus.map(row => {
                    const alert = row.amazonFbaFeeAlert
                    const alertStatus: AlertStatus = alert?.status ?? 'UNKNOWN'
                    const resolvedCurrency = alert?.currencyCode ?? currencyCode
                    const referenceFee = row.amazonFbaFulfillmentFee
                    const amazonFee = alert?.amazonFbaFulfillmentFee ?? null
                    const isMismatch = alertStatus === 'MISMATCH'

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors hover:bg-slate-50/50 ${isMismatch ? 'bg-rose-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-900">{row.skuCode}</div>
                            {row.latestBatchCode ? (
                              <div className="text-xs text-slate-500">
                                Batch: {row.latestBatchCode}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.asin ? (
                            <span className="font-mono text-xs text-slate-600">{row.asin}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium tabular-nums ${referenceFee ? 'text-slate-700' : 'text-slate-400'}`}>
                            {formatFee(referenceFee, resolvedCurrency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ArrowRight className="h-3.5 w-3.5 text-slate-300 mx-auto" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium tabular-nums ${isMismatch ? 'text-rose-600' : amazonFee ? 'text-slate-700' : 'text-slate-400'}`}>
                            {formatFee(amazonFee, resolvedCurrency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={alertStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => checkSku(row)}
                            disabled={checkingSkuId !== null}
                            className="h-8 px-3 text-xs"
                          >
                            {checkingSkuId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Currency: {currencyCode} · {skus.length} SKUs loaded
        </p>
      </PageContent>
    </PageContainer>
  )
}
