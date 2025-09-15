import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import WarehouseConfigsClientPage from './client-page'

export default async function WarehouseConfigsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    redirect(`${central}/login?callbackUrl=${encodeURIComponent(appUrl + '/config/warehouse-configs')}`)
  }

  // WarehouseSkuConfig model removed in v0.5.0
  const configs: Array<{
    id: string;
    warehouseId: string;
    warehouseName: string;
    skuId: string;
    skuCode: string;
    skuDescription: string;
    storageCartonsPerPallet: number;
    shippingCartonsPerPallet: number;
  }> = []
  const configsByWarehouse = {}
  const stats = {
    totalConfigs: 0,
    activeConfigs: 0,
    uniqueSkus: 0,
    warehouses: 0
  }

  return (
    <DashboardLayout>
      <WarehouseConfigsClientPage 
        configs={configs}
        configsByWarehouse={configsByWarehouse}
        stats={stats}
      />
    </DashboardLayout>
  )
}
