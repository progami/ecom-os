'use client'

import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PageTabs } from '@/components/ui/page-tabs'
import { PageLoading } from '@/components/ui/loading-spinner'
import { FileText, Plus, Construction, Ship, Warehouse, CheckCircle, XCircle, Archive } from '@/lib/lucide-icons'
import { PurchaseOrdersPanel, PurchaseOrderFilter } from '../inventory/purchase-orders-panel'
import { redirectToPortal } from '@/lib/portal'
import type { LucideIcon } from 'lucide-react'

type StatusConfig = {
 value: PurchaseOrderFilter
 label: string
 description: string
 hint: string
 icon: LucideIcon
}

// Main pipeline statuses
const PIPELINE_STATUSES: StatusConfig[] = [
 {
 value: 'DRAFT',
 label: 'Draft',
 description: 'Orders being prepared before proof submission',
 hint: 'Complete details before moving forward',
 icon: Construction,
 },
 {
 value: 'AWAITING_PROOF',
 label: 'Awaiting Proof',
 description: 'Waiting on delivery proof or supporting documents',
 hint: 'Upload delivery note or supporting docs',
 icon: Ship,
 },
 {
 value: 'REVIEW',
 label: 'Review',
 description: 'Proof received – ready for final approval',
 hint: 'Validate documents and approve',
 icon: Warehouse,
 },
 {
 value: 'POSTED',
 label: 'Posted',
 description: 'Orders posted to the ledger',
 hint: 'Locked for edits',
 icon: CheckCircle,
 },
]

// Terminal statuses (separate from main pipeline)
const TERMINAL_STATUSES: StatusConfig[] = [
 {
 value: 'CANCELLED',
 label: 'Cancelled',
 description: 'Orders cancelled before completion',
 hint: 'For historical reference only',
 icon: XCircle,
 },
 {
 value: 'CLOSED',
 label: 'Closed',
 description: 'Orders fully reconciled and closed',
 hint: 'Archived records',
 icon: Archive,
 },
]

const STATUS_CONFIGS = [...PIPELINE_STATUSES, ...TERMINAL_STATUSES]

type OrderType = 'PURCHASE' | 'SALES'

const ORDER_TYPE_TABS = [
  { value: 'PURCHASE', label: 'Purchase Order' },
  { value: 'SALES', label: 'Sales Order' },
]

function OrdersPage() {
 const { data: session, status } = useSession()
 const router = useRouter()
 const [orderType, setOrderType] = useState<OrderType>('PURCHASE')
 const [statusFilter, setStatusFilter] = useState<PurchaseOrderFilter>('DRAFT')

 useEffect(() => {
 if (status === 'loading') return

  if (!session) {
    redirectToPortal('/login', `${window.location.origin}/operations/orders`)
 return
 }

 if (!['staff', 'admin'].includes(session.user.role)) {
 router.push('/dashboard')
 }
 }, [session, status, router])

 // Memoize status tabs to use with PageTabs
 const statusTabs = useMemo(
   () =>
     STATUS_CONFIGS.map((config) => ({
       value: config.value,
       label: config.label,
       icon: config.icon,
     })),
   []
 )

 if (status === 'loading') {
   return (
     <DashboardLayout>
       <PageContainer>
         <PageLoading />
       </PageContainer>
     </DashboardLayout>
   )
 }

 return (
 <DashboardLayout>
 <PageContainer>
 <PageHeaderSection
 title="Orders"
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
 />
 <PageContent>
 <div className="flex flex-col gap-6">
          {/* Order Type Tabs */}
          <PageTabs
            tabs={ORDER_TYPE_TABS}
            value={orderType}
            onChange={(value) => setOrderType(value as OrderType)}
            variant="underline-lg"
          />

          {/* Status Tabs */}
          <PageTabs
            tabs={statusTabs}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as PurchaseOrderFilter)}
            variant="underline"
          />

 <PurchaseOrdersPanel
 onPosted={() => {}}
 statusFilter={statusFilter}
 typeFilter={orderType === 'PURCHASE' ? 'PURCHASE' : 'FULFILLMENT'}
 />
 </div>
 </PageContent>
 </PageContainer>
 </DashboardLayout>
 )
}

export default OrdersPage
