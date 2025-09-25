'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText } from '@/lib/lucide-icons'
import { PurchaseOrdersPanel, PurchaseOrderFilter } from '../inventory/purchase-orders-panel'

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
    description: 'Orders being prepared before proof submission',
    hint: 'Complete details before moving forward',
  },
  {
    value: 'AWAITING_PROOF',
    label: 'Awaiting Proof',
    description: 'Waiting on delivery proof or supporting documents',
    hint: 'Upload delivery note or supporting docs',
  },
  {
    value: 'REVIEW',
    label: 'Review',
    description: 'Proof received – ready for final approval',
    hint: 'Validate documents and approve',
  },
  {
    value: 'POSTED',
    label: 'Posted',
    description: 'Orders posted to the ledger',
    hint: 'Locked for edits',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Orders cancelled before completion',
    hint: 'For historical reference only',
  },
  {
    value: 'CLOSED',
    label: 'Closed',
    description: 'Orders fully reconciled and closed',
    hint: 'Archived records',
  },
]

function PurchaseOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderFilter>('DRAFT')

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', `${window.location.origin}/operations/purchase-orders`)
      window.location.href = url.toString()
      return
    }

    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  const headerActions = useMemo(() => (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500">
          <FileText className="h-4 w-4" />
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
  ), [])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-2">
        <PageHeader
          title="Purchase Orders"
          subtitle="Create, review, and post inbound or outbound orders"
          icon={FileText}
          iconColor="text-indigo-600"
          bgColor="bg-indigo-50"
          borderColor="border-indigo-200"
          textColor="text-indigo-800"
          actions={headerActions}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map(tab => {
              const isActive = statusFilter === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-muted-foreground border-border hover:bg-muted'
                  }`}
                  aria-pressed={isActive}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">{STATUS_TABS.find(tab => tab.value === statusFilter)?.label ?? 'All'}</div>
            <div>{STATUS_TABS.find(tab => tab.value === statusFilter)?.description ?? ''}</div>
            <div className="text-xs text-muted-foreground/80 mt-1">
              {STATUS_TABS.find(tab => tab.value === statusFilter)?.hint ?? ''}
            </div>
          </div>
        </div>

        <PurchaseOrdersPanel onPosted={() => {}} statusFilter={statusFilter} />
      </div>
    </DashboardLayout>
  )
}

export default PurchaseOrdersPage
