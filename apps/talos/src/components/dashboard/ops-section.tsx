import Link from 'next/link'
import { 
 Package, 
 Package2, 
 ArrowRight,
 Activity,
 Warehouse
} from '@/lib/lucide-icons'
import { format } from 'date-fns'
import {
 BarChart,
 Bar,
 ResponsiveContainer,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Cell
} from '@/components/charts/RechartsComponents'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

interface OpsSectionProps {
 data?: {
 totalInventory?: number
 inventoryChange?: string
 inventoryTrend?: 'up' | 'down' | 'neutral'
 activeSkus?: number
 warehouseDistribution?: Array<{
 name: string
 value: number
 percentage: number
 }>
 recentTransactions?: Array<{
 id: string
 type: string
 sku: string
 quantity: number
 warehouse: string
 date: string
 }>
 }
 loading?: boolean
}

export function OpsSection({ data, loading }: OpsSectionProps) {
 if (loading) {
 return (
 <div className="flex items-center justify-center h-48">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 )
 }

 return (
 <div className="space-y-2">
 {/* Key Metrics */}
 <StatsCardGrid cols={3} gap="gap-1">
 <StatsCard
 title="Total Inventory"
 value={data?.totalInventory || 0}
 subtitle={data?.inventoryChange ? `${data.inventoryTrend === 'up' ? '+' : ''}${data.inventoryChange}%` : 'No change'}
 icon={Package}
 size="sm"
 trend={data?.inventoryChange ? {
 value: parseFloat(data.inventoryChange),
 label: ""
 } : undefined}
 />
 <StatsCard
 title="Active SKUs"
 value={data?.activeSkus || 0}
 subtitle="Products in stock"
 icon={Package2}
 size="sm"
 />
 <StatsCard
 title="Warehouses"
 value={data?.warehouseDistribution?.length || 0}
 subtitle={data?.warehouseDistribution 
 ? `${data.warehouseDistribution.reduce((sum, w) => sum + w.value, 0).toLocaleString()} cartons`
 : 'Active warehouses'}
 icon={Warehouse}
 size="sm"
 />
 </StatsCardGrid>

 {/* Warehouse Distribution */}
 {data?.warehouseDistribution && data.warehouseDistribution.length > 0 && (
 <div className="border rounded-lg p-2">
 <div className="mb-2">
 <h3 className="text-lg font-semibold">Warehouse Distribution</h3>
 <p className="text-sm text-muted-foreground">Current inventory across warehouses</p>
 </div>
 <div className="h-64 sm:h-72 md:h-80">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.warehouseDistribution}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
 <XAxis 
 dataKey="name" 
 tick={{ fill: 'currentColor', fontSize: 12 }}
 tickLine={false}
 />
 <YAxis 
 tick={{ fill: 'currentColor', fontSize: 12 }}
 tickLine={false}
 tickFormatter={(value) => value.toLocaleString()}
 />
 <Tooltip 
 contentStyle={{ 
 backgroundColor: 'hsl(var(--background))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '6px'
 }}
 content={({ active, payload, label }) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 return (
 <div className="p-3">
 <p className="font-medium">{label}</p>
 <p className="text-sm text-muted-foreground">
 {data.value.toLocaleString()} cartons ({data.percentage}%)
 </p>
 </div>
 );
 }
 return null;
 }}
 cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
 />
 <Bar dataKey="value" radius={[8, 8, 0, 0]}>
 {data.warehouseDistribution.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}

 {/* Recent Activity */}
 {data?.recentTransactions && data.recentTransactions.length > 0 && (
 <div className="border rounded-lg p-2">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-lg font-semibold">Recent Activity</h3>
 <Link href="/operations/inventory" className="text-sm text-primary hover:underline">
 View all
 </Link>
 </div>
 <div className="space-y-1">
 {data.recentTransactions.slice(0, 3).map((transaction) => (
 <div key={transaction.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-lg ${
 transaction.type === 'RECEIVE' ? 'bg-green-100 ' :
 transaction.type === 'SHIP' ? 'bg-cyan-100 ' :
 'bg-yellow-100 '
 }`}>
 {transaction.type === 'RECEIVE' ? (
 <ArrowRight className="h-4 w-4 text-green-600 rotate-180" />
 ) : transaction.type === 'SHIP' ? (
 <ArrowRight className="h-4 w-4 text-cyan-600 " />
 ) : (
 <Activity className="h-4 w-4 text-yellow-600 " />
 )}
 </div>
 <div>
 <p className="text-sm font-medium">{transaction.sku}</p>
 <p className="text-xs text-muted-foreground">
 {transaction.quantity} cartons • {transaction.warehouse}
 </p>
 </div>
 </div>
 <p className="text-xs text-muted-foreground">
 {format(new Date(transaction.date), 'MMM dd, yyyy')}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 </div>
 )
}