'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText, Plus } from '@/lib/lucide-icons'
import { PurchaseOrdersPanel, PurchaseOrderFilter } from '../inventory/purchase-orders-panel'
import { redirectToPortal } from '@/lib/portal'

type StatusConfig = {
 value: PurchaseOrderFilter
 label: string
 description: string
 hint: string
}

// Main pipeline statuses
const PIPELINE_STATUSES: StatusConfig[] = [
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
]

// Terminal statuses (separate from main pipeline)
const TERMINAL_STATUSES: StatusConfig[] = [
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

const STATUS_TABS = [...PIPELINE_STATUSES, ...TERMINAL_STATUSES]

function PurchaseOrdersPage() {
 const { data: session, status } = useSession()
 const router = useRouter()
 const [statusFilter, setStatusFilter] = useState<PurchaseOrderFilter>('DRAFT')

 useEffect(() => {
 if (status === 'loading') return

 if (!session) {
 redirectToPortal('/login', `${window.location.origin}/operations/purchase-orders`)
 return
 }

 if (!['staff', 'admin'].includes(session.user.role)) {
 router.push('/dashboard')
 }
 }, [session, status, router])

 if (status === 'loading') {
 return (
 <DashboardLayout>
 <PageContainer>
 <div className="flex h-full items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent " />
 </div>
 </PageContainer>
 </DashboardLayout>
 )
 }

 return (
 <DashboardLayout>
 <PageContainer>
 <PageHeaderSection
 title="Purchase Orders"
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
 {/* Status Tabs */}
 <div className="border-b">
 <nav className="-mb-px flex space-x-8">
 {STATUS_TABS.map(tab => {
 const isActive = statusFilter === tab.value
 return (
 <button
 key={tab.value}
 type="button"
 onClick={() => setStatusFilter(tab.value)}
 className={`py-2 px-1 border-b-2 font-medium text-sm ${
 isActive
 ? 'border-primary text-primary'
 : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
 }`}
 >
 {tab.label}
 </button>
 )
 })}
 </nav>
 </div>

 <PurchaseOrdersPanel onPosted={() => {}} statusFilter={statusFilter} />
 </div>
 </PageContent>
 </PageContainer>
 </DashboardLayout>
 )
}

export default PurchaseOrdersPage
