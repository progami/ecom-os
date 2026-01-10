'use client'

import { Suspense } from 'react'
import { Building } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from '@/lib/lucide-icons'
import WarehousesPanel from './warehouses-panel'
import { ImportButton } from '@/components/ui/import-button'

export default function WarehousesPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-6">Loading warehouses...</div>
        </DashboardLayout>
      }
    >
      <WarehousesPageContent />
    </Suspense>
  )
}

function WarehousesPageContent() {
  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Warehouses"
          description="Configuration"
          icon={Building}
          actions={
            <div className="flex items-center gap-2">
              <ImportButton entityName="warehouses" onImportComplete={() => window.location.reload()} />
              <Button asChild className="gap-2">
                <Link href="/config/warehouses/new">
                  <Plus className="h-4 w-4" />
                  Add Warehouse
                </Link>
              </Button>
            </div>
          }
        />
        <PageContent>
          <WarehousesPanel />
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
