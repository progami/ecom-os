import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Building, Package2, Settings, AlertCircle, Edit } from 'lucide-react'
import { DashboardLayout } from '@/components/wms/layout/dashboard-layout'
import { PageHeader } from '@/components/wms/shared/page-header'
import Link from 'next/link'

export default async function WarehouseConfigsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    redirect('/auth/login')
  }

  // Get all warehouse-SKU configurations with related data
  const configs = await prisma.warehouseSkuConfig.findMany({
    include: {
      warehouse: true,
      sku: true,
      createdBy: {
        select: {
          fullName: true,
          email: true
        }
      }
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { sku: { skuCode: 'asc' } },
      { effectiveDate: 'desc' }
    ]
  })

  // Group configs by warehouse
  const configsByWarehouse = configs.reduce((acc, config) => {
    const warehouseName = config.warehouse.name
    if (!acc[warehouseName]) {
      acc[warehouseName] = []
    }
    acc[warehouseName].push(config)
    return acc
  }, {} as Record<string, typeof configs>)

  // Get summary stats
  const totalConfigs = configs.length
  const activeConfigs = configs.filter(c => !c.endDate || new Date(c.endDate) > new Date()).length
  const uniqueSkus = new Set(configs.map(c => c.skuId)).size
  const warehouses = Object.keys(configsByWarehouse).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Warehouse SKU Configurations"
          subtitle="Manage cartons per pallet settings"
          description="Configure how many cartons fit on a pallet for each SKU in each warehouse. These settings are crucial for accurate storage calculations and billing. Different values can be set for storage vs shipping operations."
          icon={Building}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
          textColor="text-purple-800"
          actions={
            <Link
              href="/wms/admin/settings/warehouse-configs/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
            >
              <Settings className="h-4 w-4 mr-2" />
              Add Configuration
            </Link>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Warehouses</p>
                <p className="text-2xl font-bold">{warehouses}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Package2 className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Configured SKUs</p>
                <p className="text-2xl font-bold">{uniqueSkus}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Active Configs</p>
                <p className="text-2xl font-bold">{activeConfigs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Total Configs</p>
                <p className="text-2xl font-bold">{totalConfigs}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Critical Configuration</p>
              <p>These settings directly impact storage calculations and billing. The system uses these values to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Calculate pallets from cartons for storage charges</li>
                <li>Determine shipping pallet requirements</li>
                <li>Generate accurate billing based on pallet usage</li>
              </ul>
              <p className="mt-2">Changes take effect from the specified effective date forward.</p>
            </div>
          </div>
        </div>

        {/* Configurations by Warehouse */}
        <div className="space-y-6">
          {Object.entries(configsByWarehouse).map(([warehouseName, warehouseConfigs]) => (
            <div key={warehouseName} className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building className="h-5 w-5 text-gray-600" />
                  {warehouseName}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Storage<br />Cartons/Pallet
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipping<br />Cartons/Pallet
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Stack<br />Height (cm)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {warehouseConfigs.map((config) => {
                      const isActive = !config.endDate || new Date(config.endDate) > new Date()
                      const isCurrentlyEffective = new Date(config.effectiveDate) <= new Date() && isActive
                      
                      return (
                        <tr key={config.id} className={!isActive ? 'bg-gray-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {config.sku.skuCode}
                              </div>
                              <div className="text-xs text-gray-500">
                                {config.sku.description}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-lg font-semibold text-blue-600">
                              {config.storageCartonsPerPallet}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-lg font-semibold text-green-600">
                              {config.shippingCartonsPerPallet}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            {config.maxStackingHeightCm || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(config.effectiveDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {config.endDate ? new Date(config.endDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isCurrentlyEffective ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Future
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Expired
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Link
                              href={`/wms/admin/settings/warehouse-configs/${config.id}/edit`}
                              className="text-primary hover:text-primary/80"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {configs.length === 0 && (
          <div className="bg-white border rounded-lg p-12 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Configurations Found</h3>
            <p className="text-gray-600 mb-4">
              Start by adding warehouse-SKU configurations to enable storage calculations.
            </p>
            <Link
              href="/wms/admin/settings/warehouse-configs/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
            >
              <Settings className="h-4 w-4 mr-2" />
              Add First Configuration
            </Link>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Understanding Warehouse Configurations</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Storage Cartons per Pallet</h4>
              <p className="text-sm text-gray-700">
                Used for calculating storage charges. The system divides total cartons by this value 
                (rounded up) to determine pallets used for storage billing. Amazon warehouses use cubic feet for monthly billing instead.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Shipping Cartons per Pallet</h4>
              <p className="text-sm text-gray-700">
                Used when shipping goods. Different from storage as shipping pallets may be stacked 
                differently or use different pallet types.
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white/70 rounded">
            <p className="text-sm text-gray-700">
              <strong>Example:</strong> If an SKU has 14 cartons per pallet for storage and you have 50 cartons, 
              the system calculates: 50 ÷ 14 = 3.57, rounded up to 4 pallets for billing.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}