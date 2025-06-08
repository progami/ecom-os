'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Package2, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  ArrowRight,
  FileText,
  BarChart3,
  Settings,
  Users,
  Warehouse,
  Calculator
} from 'lucide-react'
import { DashboardLayout } from '@/components/wms/layout/dashboard-layout'
import { PageHeader } from '@/components/wms/shared/page-header'
import { QuickStartGuide } from '@/components/ui/quick-start-guide'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/wms/auth/login')
      return
    }
    fetchDashboardStats()
  }, [session, status, router])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/v1/wms/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Failed to fetch dashboard stats')
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back, ${session.user.name}`}
          description="Monitor your warehouse operations at a glance. Track inventory levels, storage costs, active SKUs, and pending invoices. Use the navigation menu to access detailed reports and management tools."
          icon={Package2}
        />

        {/* Quick Start Guide */}
        <QuickStartGuide userRole={session.user.role} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Total Inventory"
            value={stats?.totalInventory?.toLocaleString() || '--'}
            description="Cartons across all warehouses"
            icon={Package2}
            trend={stats ? `${stats.inventoryTrend === 'up' ? '+' : ''}${stats.inventoryChange}% from last month` : 'Loading...'}
            trendUp={stats?.inventoryTrend === 'up' ? true : stats?.inventoryTrend === 'down' ? false : null}
          />
          <DashboardCard
            title="Storage Cost"
            value={stats ? `£${parseFloat(stats.storageCost).toLocaleString()}` : '--'}
            description="Current billing period"
            icon={DollarSign}
            trend={stats ? `${stats.costTrend === 'up' ? '+' : ''}${stats.costChange}% from last period` : 'Loading...'}
            trendUp={stats?.costTrend === 'up' ? true : stats?.costTrend === 'down' ? false : null}
          />
          <DashboardCard
            title="Active SKUs"
            value={stats?.activeSkus?.toString() || '--'}
            description="Products in stock"
            icon={TrendingUp}
            trend="With inventory"
            trendUp={null}
          />
          <DashboardCard
            title="Pending Invoices"
            value={stats?.pendingInvoices?.toString() || '--'}
            description="Awaiting reconciliation"
            icon={AlertCircle}
            trend={stats && stats.overdueInvoices > 0 ? `${stats.overdueInvoices} overdue` : 'All current'}
            trendUp={stats?.overdueInvoices === 0}
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {getQuickActions(session.user.role).map((action: any, index: number) => (
              <Link
                key={index}
                href={action.href}
                className="border rounded-lg p-6 hover:border-primary hover:shadow-md transition-all group bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${action.bgColor} group-hover:scale-110 transition-transform`}>
                        <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                      </div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {action.title}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your recent receiving and shipping activities
              </p>
              <div className="border-t pt-4">
                <p className="text-center text-gray-500 py-8">
                  <Package2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  No recent transactions
                </p>
              </div>
            </div>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Storage Utilization</h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Current warehouse capacity and usage
              </p>
              <div className="border-t pt-4">
                <p className="text-center text-gray-500 py-8">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  Utilization data coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface DashboardCardProps {
  title: string
  value: string
  description: string
  icon: React.ElementType
  trend: string
  trendUp: boolean | null
}

function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
}: DashboardCardProps) {
  return (
    <div className="border rounded-lg p-6 card-hover">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h2 className="text-2xl font-bold mt-1">{value}</h2>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          <p
            className={`text-xs mt-2 ${
              trendUp === true
                ? 'text-green-600'
                : trendUp === false
                ? 'text-red-600'
                : 'text-muted-foreground'
            }`}
          >
            {trend}
          </p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
    </div>
  )
}

function getQuickActions(role: string) {
  const allActions = {
    inventory: {
      title: 'Manage Inventory',
      description: 'View and update inventory levels',
      href: '/wms/operations/inventory',
      icon: Package2,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    receive: {
      title: 'Receive Shipments',
      description: 'Process incoming inventory',
      href: '/wms/operations/receive',
      icon: Package2,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    ship: {
      title: 'Ship Orders',
      description: 'Process outbound shipments',
      href: '/wms/operations/ship',
      icon: Package2,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    invoices: {
      title: 'Process Invoices',
      description: 'Upload and reconcile invoices',
      href: '/wms/finance/invoices',
      icon: FileText,
      bgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-600'
    },
    rates: {
      title: 'Cost Rates',
      description: 'Manage warehouse rates',
      href: '/wms/config/rates',
      icon: DollarSign,
      bgColor: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    reconciliation: {
      title: 'Reconciliation',
      description: 'Compare calculations with invoices',
      href: '/wms/finance/reconciliation',
      icon: Calculator,
      bgColor: 'bg-indigo-100',
      iconColor: 'text-indigo-600'
    },
    reports: {
      title: 'Generate Reports',
      description: 'Create custom reports',
      href: '/wms/reports',
      icon: BarChart3,
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    settings: {
      title: 'System Settings',
      description: 'Configure system parameters',
      href: '/wms/admin/settings',
      icon: Settings,
      bgColor: 'bg-gray-100',
      iconColor: 'text-gray-600'
    },
    users: {
      title: 'Manage Users',
      description: 'User accounts and permissions',
      href: '/wms/admin/users',
      icon: Users,
      bgColor: 'bg-pink-100',
      iconColor: 'text-pink-600'
    }
  }

  const roleActions: Record<string, string[]> = {
    admin: ['inventory', 'invoices', 'rates', 'reports', 'settings', 'users'],
    staff: ['inventory', 'receive', 'ship', 'invoices', 'rates', 'reconciliation', 'reports']
  }

  const actions = roleActions[role] || roleActions.staff
  return actions.map(key => allActions[key as keyof typeof allActions]).filter(Boolean)
}