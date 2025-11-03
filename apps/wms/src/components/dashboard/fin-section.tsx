import Link from 'next/link'
import { 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  ArrowRight
} from '@/lib/lucide-icons'

interface FinSectionProps {
  data?: {
    storageCost?: string
    costChange?: string
    costTrend?: 'up' | 'down' | 'neutral'
  }
  loading?: boolean
}

export function FinSection({ data, loading }: FinSectionProps) {
 if (loading) {
 return (
 <div className="flex items-center justify-center h-48">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 )
 }

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Storage Cost</p>
            <h3 className="text-2xl font-bold mt-1">£{data?.storageCost || '--'}</h3>
            <div className="flex items-center gap-2 mt-2">
              {data?.costTrend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : data?.costTrend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {data?.costChange ? `${data.costTrend === 'up' ? '+' : ''}${data.costChange}%` : 'No change'}
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-green-100 ">
            <DollarSign className="h-6 w-6 text-green-600 " />
          </div>
        </div>
      </div>

      <Link 
        href="/finance/storage-ledger" 
        className="block border rounded-lg p-4 hover:bg-slate-50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 ">
              <DollarSign className="h-5 w-5 text-green-600 " />
            </div>
            <div>
              <h3 className="font-semibold">View Storage Cost Trends</h3>
              <p className="text-sm text-muted-foreground">Detailed weekly and monthly cost analysis</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>
      </Link>
    </div>
  )
}
