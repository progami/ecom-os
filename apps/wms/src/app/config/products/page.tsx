'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Package, Package2 } from '@/lib/lucide-icons'
import InventoryPanel from './inventory-panel'
import SkusPanel from './skus-panel'
import { redirectToPortal } from '@/lib/portal'
import { PageTabs } from '@/components/ui/page-tabs'

const ALLOWED_ROLES = ['admin', 'staff']
const TABS = [
  { value: 'skus', label: 'SKUs', icon: Package2 },
  { value: 'inventory', label: 'Inventory', icon: Package },
] as const

function ProductsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const currentTab = useMemo(() => {
    const tab = searchParams.get('tab')
    if (tab && TABS.some((t) => t.value === tab)) {
      return tab
    }
    return 'skus'
  }, [searchParams])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      redirectToPortal('/login', `${window.location.origin}${basePath}/config/products`)
      return
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      toast.error('You are not authorised to view products')
      router.push('/dashboard')
    }
  }, [router, session, status])

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`/config/products?${params.toString()}`)
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
          title="Products"
          description="Manage SKU master data and inventory"
          icon={Package}
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            <PageTabs tabs={[...TABS]} value={currentTab} onChange={handleTabChange} variant="underline" />

            {currentTab === 'skus' ? <SkusPanel /> : null}
            {currentTab === 'inventory' ? <InventoryPanel /> : null}
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

export default function ProductsPage() {
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
      <ProductsPageContent />
    </Suspense>
  )
}
