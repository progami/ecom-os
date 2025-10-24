import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Settings } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import WarehouseConfigsClientPage, {
  type WarehouseConfig,
  type WarehouseConfigsClientPageProps
} from './client-page'

export default async function WarehouseConfigsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    const portalAuth = process.env.PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    redirect(`${portalAuth}/login?callbackUrl=${encodeURIComponent(appUrl + '/config/warehouse-configs')}`)
  }

  // WarehouseSkuConfig model removed in v0.5.0
  const configs: WarehouseConfig[] = []
  const configsByWarehouse: WarehouseConfigsClientPageProps['configsByWarehouse'] = {}
  const stats: WarehouseConfigsClientPageProps['stats'] = {
    totalConfigs: 0,
    activeConfigs: 0,
    uniqueSkus: 0,
    warehouses: 0
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Warehouse Configs"
          description="Configuration"
          icon={Settings}
        />
        <PageContent>
          <WarehouseConfigsClientPage
            configs={configs}
            configsByWarehouse={configsByWarehouse}
            stats={stats}
          />
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
