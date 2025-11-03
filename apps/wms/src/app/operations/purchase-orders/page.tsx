'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText, Plus } from '@/lib/lucide-icons'
import { PurchaseOrdersPanel, PurchaseOrderFilter } from '../inventory/purchase-orders-panel'
import { cn } from '@/lib/utils'
import { redirectToPortal } from '@/lib/portal'

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

 const currentTab = STATUS_TABS.find(tab => tab.value === statusFilter)

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
 metadata={
 <div className="flex flex-wrap items-center gap-2">
 {STATUS_TABS.map(tab => {
 const isActive = statusFilter === tab.value
 return (
 <button
 key={tab.value}
 type="button"
 onClick={() => setStatusFilter(tab.value)}
 className={cn(
 'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
 isActive
 ? 'bg-cyan-600 text-white shadow-md '
 : 'bg-slate-100 text-slate-700 hover:bg-slate-200 '
 )}
 aria-pressed={isActive}
 >
 {tab.label}
 </button>
 )
 })}
 </div>
 }
 />
 <PageContent>
 <div className="flex flex-col gap-4">
 {currentTab && (
 <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft ">
 <div className="text-sm font-semibold text-slate-900 ">{currentTab.label}</div>
 <div className="mt-1 text-sm text-slate-600 ">{currentTab.description}</div>
 <div className="mt-2 text-xs text-slate-500 ">{currentTab.hint}</div>
 </div>
 )}
 <PurchaseOrdersPanel onPosted={() => {}} statusFilter={statusFilter} />
 </div>
 </PageContent>
 </PageContainer>
 </DashboardLayout>
 )
}

export default PurchaseOrdersPage
