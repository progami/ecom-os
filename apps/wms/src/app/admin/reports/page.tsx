import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TrendingUp, DollarSign, FileText, Package } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { StatsCard } from '@/components/ui/stats-card'
import { AdminReportsClient } from './client-page'
import { prisma } from '@/lib/prisma'
import { portalOrigin } from '@/lib/portal'

export default async function AdminReportsPage() {
 const session = await getServerSession(authOptions)

 if (!session || session.user.role !== 'admin') {
 const portalAuth = portalOrigin()
 const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
 redirect(`${portalAuth}/login?callbackUrl=${encodeURIComponent(appUrl + '/admin/reports')}`)
 }

 // Fetch current stats
 const currentMonth = new Date()
 const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
 
 const [storageCost, movements, invoices] = await Promise.all([
 // Total storage cost this month
 prisma.storageLedger.aggregate({
 where: {
 weekEndingDate: {
 gte: startOfMonth,
 lte: currentMonth
 }
 },
 _sum: {
 averageBalance: true
 }
 }),
 // Total movements this month
 prisma.inventoryTransaction.count({
 where: {
 transactionDate: {
 gte: startOfMonth,
 lte: currentMonth
 }
 }
 }),
 // Invoices this month - commented out as invoice model no longer exists
 Promise.resolve(0)
 ])

 return (
 <DashboardLayout>
 <div className="space-y-2">
 {/* Header */}
 <div>
 <h1 className="text-3xl font-bold">Reports & Analytics</h1>
 <p className="text-muted-foreground">
 Generate and view comprehensive reports
 </p>
 </div>

 {/* Quick Stats */}
 <div className="grid gap-1 md:grid-cols-4">
 <StatsCard
 title="Total Storage Cost"
 value={`£${(Number(storageCost._sum.averageBalance || 0) * 0.5).toFixed(2)}`}
 subtitle="This Month"
 icon={DollarSign}
 size="sm"
 trend={{ value: 12, label: "vs last month" }}
 />
 <StatsCard
 title="Inventory Turnover"
 value="4.2x"
 subtitle="Last 30 Days"
 icon={TrendingUp}
 variant="success"
 size="sm"
 trend={{ value: 5, label: "increase" }}
 />
 <StatsCard
 title="Total Movements"
 value={movements.toString()}
 subtitle="This Month"
 icon={Package}
 variant="info"
 size="sm"
 trend={{ value: 8, label: "vs last month" }}
 />
 <StatsCard
 title="Invoices Processed"
 value={invoices.toString()}
 subtitle="This Month"
 icon={FileText}
 variant="warning"
 size="sm"
 trend={{ value: 15, label: "vs last month" }}
 />
 </div>

 {/* Report Generation Section */}
 <AdminReportsClient />

 {/* Recent Reports */}
 <div className="border rounded-lg p-2">
 <h3 className="text-lg font-semibold mb-4">Recently Generated Reports</h3>
 <div className="text-sm text-muted-foreground">
 No reports generated yet. Select a report type above to get started.
 </div>
 </div>
 </div>
 </DashboardLayout>
 )
}
