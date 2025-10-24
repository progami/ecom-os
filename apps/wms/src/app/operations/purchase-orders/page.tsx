'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText, Plus } from '@/lib/lucide-icons'
import { PurchaseOrdersPanel, PurchaseOrderFilter, PurchaseOrderTypeOption } from '../inventory/purchase-orders-panel'
import { cn } from '@/lib/utils'
import { buildCentralLoginUrl } from '@/lib/utils/url'

type StatusConfig = {
  value: PurchaseOrderFilter
  label: string
  description: string
  hint: string
}

const STATUS_TABS: StatusConfig[] = [
  {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Orders being prepared before departure',
    hint: 'Attach pro forma and confirm supplier details',
  },
  {
    value: 'SHIPPED',
    label: 'In Transit',
    description: 'Goods are in transit from supplier or to customer',
    hint: 'Collect commercial docs while cargo is moving',
  },
  {
    value: 'WAREHOUSE',
    label: 'At Warehouse',
    description: 'Delivery note received – ready for admin approval',
    hint: 'Admins approve delivery notes to release stock',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Orders cancelled before completion',
    hint: 'Historical reference only',
  },
  {
    value: 'CLOSED',
    label: 'Closed',
    description: 'Orders fully reconciled and closed',
    hint: 'Archived records',
  },
]

type OrderTypeTab = {
  value: PurchaseOrderTypeOption
  label: string
  description: string
}

const ORDER_TYPE_TABS: OrderTypeTab[] = [
  {
    value: 'PURCHASE',
    label: 'Purchase Orders',
    description: '',
  },
  {
    value: 'FULFILLMENT',
    label: 'Ship Orders',
    description: '',
  },
]

function PurchaseOrdersLoading() {
  return (
    <DashboardLayout>
      <PageContainer>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      </PageContainer>
    </DashboardLayout>
  )
}

function PurchaseOrdersPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const statusValues = useMemo(() => STATUS_TABS.map(tab => tab.value), [])

  const typeValues = useMemo(() => ORDER_TYPE_TABS.map(tab => tab.value), [])

  const searchParamStatus = searchParams?.get('status') as PurchaseOrderFilter | null
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderFilter>(
    searchParamStatus && statusValues.includes(searchParamStatus) ? searchParamStatus : 'DRAFT'
  )

  const searchParamType = searchParams?.get('type') as PurchaseOrderTypeOption | null
  const [typeFilter, setTypeFilter] = useState<PurchaseOrderTypeOption>(
    searchParamType && typeValues.includes(searchParamType) ? searchParamType : 'PURCHASE'
  )

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      window.location.href = buildCentralLoginUrl('/operations/purchase-orders')
      return
    }

    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  useEffect(() => {
    const param = searchParams?.get('status') as PurchaseOrderFilter | null
    const nextValue = param && statusValues.includes(param) ? param : 'DRAFT'
    setStatusFilter(prev => (prev === nextValue ? prev : nextValue))
  }, [searchParams, statusValues])

  useEffect(() => {
    const param = searchParams?.get('type') as PurchaseOrderTypeOption | null
    const nextValue = param && typeValues.includes(param) ? param : 'PURCHASE'
    setTypeFilter(prev => (prev === nextValue ? prev : nextValue))
  }, [searchParams, typeValues])

  const handleTabChange = useCallback((value: PurchaseOrderFilter) => {
    setStatusFilter(value)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (value === 'DRAFT') {
      params.delete('status')
    } else {
      params.set('status', value)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const handleTypeChange = useCallback((value: PurchaseOrderTypeOption) => {
    setTypeFilter(value)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (value === 'PURCHASE') {
      params.delete('type')
    } else {
      params.set('type', value)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  if (status === 'loading') {
    return <PurchaseOrdersLoading />
  }

  const currentTypeTab = ORDER_TYPE_TABS.find(tab => tab.value === typeFilter)

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title={currentTypeTab?.label ?? 'Purchase Orders'}
          description="Operations"
          icon={FileText}
          actions={
            <Popover>
              <PopoverTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Raise PO
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-1 p-2">
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href="/operations/receive" prefetch={false}>
                    Receive (Inbound PO)
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href="/operations/ship" prefetch={false}>
                    Ship (Outbound PO)
                  </Link>
                </Button>
              </PopoverContent>
            </Popover>
          }
          metadata={
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
              {ORDER_TYPE_TABS.map(tab => {
                const isActive = typeFilter === tab.value
                return (
                  <button
                    key={tab.value}
                      type="button"
                      onClick={() => handleTypeChange(tab.value)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-cyan-700 text-white shadow-md'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      )}
                      aria-pressed={isActive}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_TABS.map(tab => {
                  const isActive = statusFilter === tab.value
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => handleTabChange(tab.value)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      )}
                      aria-pressed={isActive}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          }
        />
        <PageContent>
          <div className="flex flex-col gap-4">
            <PurchaseOrdersPanel onPosted={() => {}} statusFilter={statusFilter} typeFilter={typeFilter} />
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<PurchaseOrdersLoading />}>
      <PurchaseOrdersPageContent />
    </Suspense>
  )
}
