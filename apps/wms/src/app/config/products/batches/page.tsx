'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useSession } from '@/hooks/usePortalSession'
import { redirectToPortal } from '@/lib/portal'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Boxes, Loader2, Search } from '@/lib/lucide-icons'
import { cn } from '@/lib/utils'
import { SkuBatchesPanel } from '../sku-batches-modal'

const ALLOWED_ROLES = ['admin', 'staff']

type SkuSummary = {
  id: string
  skuCode: string
  description: string
  isActive: boolean
}

export default function ProductBatchesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent " />
              <span>Loading…</span>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <ProductBatchesPageInner />
    </Suspense>
  )
}

function ProductBatchesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedSkuIdParam = searchParams.get('skuId')

  const { data: session, status } = useSession()
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [skuSearch, setSkuSearch] = useState('')
  const [skus, setSkus] = useState<SkuSummary[]>([])
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(selectedSkuIdParam)

  useEffect(() => {
    setSelectedSkuId(selectedSkuIdParam)
  }, [selectedSkuIdParam])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      redirectToPortal('/login', `${window.location.origin}${basePath}/config/products/batches`)
      return
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      toast.error('You are not authorised to view product batches')
      router.push('/dashboard')
    }
  }, [router, session, status])

  useEffect(() => {
    if (!session || !ALLOWED_ROLES.includes(session.user.role)) return

    let cancelled = false
    setLoadingSkus(true)

    fetch('/api/skus?includeInactive=true', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load SKUs')
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data) ? data : []
        setSkus(
          rows.map((sku) => ({
            id: sku.id,
            skuCode: sku.skuCode,
            description: sku.description,
            isActive: Boolean(sku.isActive),
          }))
        )
      })
      .catch((error) => {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : 'Failed to load SKUs')
      })
      .finally(() => {
        if (cancelled) return
        setLoadingSkus(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const filteredSkus = useMemo(() => {
    const term = skuSearch.trim().toLowerCase()
    if (!term) return skus
    return skus.filter((sku) => {
      return (
        sku.skuCode.toLowerCase().includes(term) || sku.description.toLowerCase().includes(term)
      )
    })
  }, [skuSearch, skus])

  const selectedSku = useMemo(() => {
    if (!selectedSkuId) return null
    return skus.find((sku) => sku.id === selectedSkuId) ?? null
  }, [selectedSkuId, skus])

  const setSkuInUrl = (skuId: string | null) => {
    if (!skuId) {
      router.push('/config/products/batches')
      return
    }
    router.push(`/config/products/batches?skuId=${encodeURIComponent(skuId)}`)
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent " />
            <span>Loading…</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
    return null
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Batches"
          description="Configuration"
          icon={Boxes}
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link href="/config/products">
                <ArrowLeft className="h-4 w-4" />
                Back to SKUs
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border bg-white shadow-soft">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">SKUs</span>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                    {skus.length}
                  </Badge>
                </div>
                {selectedSku ? (
                  <Button variant="ghost" size="sm" onClick={() => setSkuInUrl(null)}>
                    Clear
                  </Button>
                ) : null}
              </div>

              <div className="p-5">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder="Search SKUs…"
                    className="pl-10"
                  />
                </div>

                {loadingSkus ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredSkus.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">No SKUs found</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto">
                    <ul className="space-y-1">
                      {filteredSkus.map((sku) => {
                        const active = sku.id === selectedSku?.id
                        return (
                          <li key={sku.id}>
                            <button
                              type="button"
                              onClick={() => setSkuInUrl(sku.id)}
                              className={cn(
                                'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                                active
                                  ? 'border-cyan-200 bg-cyan-50/50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {sku.skuCode}
                                  </div>
                                  <div className="truncate text-xs text-slate-500">
                                    {sku.description}
                                  </div>
                                </div>
                                <Badge
                                  className={
                                    sku.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }
                                >
                                  {sku.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedSku ? (
                <SkuBatchesPanel sku={selectedSku} key={selectedSku.id} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border bg-white p-10 text-center">
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-slate-900">Select a SKU</div>
                    <div className="text-sm text-slate-500">
                      Choose a SKU to view and manage its batches.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
