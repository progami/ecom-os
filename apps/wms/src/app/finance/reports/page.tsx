import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FileText, Download, DollarSign, TrendingUp, Package2, Calendar, FileBarChart } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

export default async function FinanceReportsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    redirect(`${central}/login?callbackUrl=${encodeURIComponent(appUrl + '/finance/reports')}`)
  }

  // Both admin and staff can access finance reports
  if (!['admin', 'staff'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const reports = [
    {
      name: 'Monthly Billing Summary',
      description: 'Consolidated charges by warehouse and category',
      icon: DollarSign,
      category: 'Financial',
      lastGenerated: 'Today',
      featured: true,
    },
    {
      name: 'Invoice Reconciliation Report',
      description: 'Compare expected vs actual charges',
      icon: FileText,
      category: 'Financial',
      lastGenerated: 'Yesterday',
      featured: true,
    },
    {
      name: 'Storage Cost Analysis',
      description: 'Weekly storage charges breakdown',
      icon: Package2,
      category: 'Operations',
      lastGenerated: '2 days ago',
    },
    {
      name: 'Cost Variance Report',
      description: 'Identify billing discrepancies',
      icon: TrendingUp,
      category: 'Financial',
      lastGenerated: 'Last week',
    },
    {
      name: 'Warehouse Performance',
      description: 'Cost efficiency by warehouse',
      icon: TrendingUp,
      category: 'Analytics',
      lastGenerated: 'Last week',
    },
    {
      name: 'Annual Cost Trends',
      description: 'Year-over-year cost analysis',
      icon: Calendar,
      category: 'Analytics',
      lastGenerated: 'Monthly',
    },
  ]

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Reports"
          description="Finance"
          icon={FileBarChart}
          actions={
            <Button className="gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Reports
            </Button>
          }
        />
        <PageContent>

        {/* Featured Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Featured Reports</h2>
          <div className="grid gap-1 md:grid-cols-2">
            {reports.filter(r => r.featured).map((report, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-2 hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white rounded-lg shadow-soft">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="badge-primary">{report.category}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{report.name}</h3>
                <p className="text-sm text-slate-600 mb-4">{report.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Last generated: {report.lastGenerated}
                  </p>
                  <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
                    <Download className="h-4 w-4" />
                    Generate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4">All Reports</h2>
          <div className="grid gap-1 md:grid-cols-3">
            {reports.filter(r => !r.featured).map((report, index) => (
              <div
                key={index}
                className="bg-white border rounded-lg p-2 hover:shadow-lg transition-all duration-200 hover:border-primary cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <report.icon className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {report.category}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-primary mb-1">
                  {report.name}
                </h3>
                <p className="text-sm text-slate-600 mb-3">{report.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {report.lastGenerated}
                  </p>
                  <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Report Builder */}
        <div className="bg-gradient-to-r from-cyan-50 to-brand-teal-50 border border-cyan-200 rounded-lg p-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Custom Report Builder</h3>
              <p className="text-sm text-slate-600">Create custom reports with specific filters</p>
            </div>
            <Button>Create Custom Report</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-1 mt-2">
            <div className="bg-white p-2 rounded-lg text-center">
              <Package2 className="h-8 w-8 mx-auto mb-2 text-cyan-600" />
              <p className="text-sm font-medium">By Warehouse</p>
            </div>
            <div className="bg-white p-2 rounded-lg text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-cyan-600" />
              <p className="text-sm font-medium">By Period</p>
            </div>
            <div className="bg-white p-2 rounded-lg text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-cyan-600" />
              <p className="text-sm font-medium">By Cost Type</p>
            </div>
            <div className="bg-white p-2 rounded-lg text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-cyan-600" />
              <p className="text-sm font-medium">Trends</p>
            </div>
          </div>
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
