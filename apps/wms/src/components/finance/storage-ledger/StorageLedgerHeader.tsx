import { useState } from 'react'
import { Download, RefreshCw } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface StorageLedgerHeaderProps {
 aggregationView: 'weekly' | 'monthly'
 onAggregationChange: (view: 'weekly' | 'monthly') => void
 onExport: () => void
 onRefresh?: () => void
}

export function StorageLedgerHeader({
 aggregationView,
 onAggregationChange,
 onExport,
 onRefresh,
}: StorageLedgerHeaderProps) {
 const [isCalculating, setIsCalculating] = useState(false)

 const handleWeeklySync = async () => {
 if (isCalculating) return
 
 setIsCalculating(true)
 try {
 const response = await fetch('/api/finance/storage-calculation/weekly', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 weekEndingDate: new Date().toISOString(),
 forceRecalculate: false
 })
 })

 if (!response.ok) {
 throw new Error(`Weekly sync failed: ${response.status}`)
 }

 const result = await response.json()
 toast.success(`Weekly sync completed: ${result.processed} entries processed, ${result.costCalculated} costs calculated`)
 
 if (onRefresh) {
 onRefresh()
 }
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Unknown error'
 toast.error(`Weekly sync failed: ${message}`)
 } finally {
 setIsCalculating(false)
 }
 }

 return (
 <div className="flex flex-wrap items-center gap-3">
 <div className="flex items-center gap-2 rounded-xl border border-muted">
 <button
 onClick={() => onAggregationChange('weekly')}
 className={cn(
 'px-3 py-2 rounded-l-lg transition-colors',
 aggregationView === 'weekly'
 ? 'bg-primary text-primary-foreground shadow-soft'
 : 'text-muted-foreground hover:bg-muted/30'
 )}
 >
 Weekly
 </button>
 <button
 onClick={() => onAggregationChange('monthly')}
 className={cn(
 'px-3 py-2 rounded-r-lg transition-colors',
 aggregationView === 'monthly'
 ? 'bg-primary text-primary-foreground shadow-soft'
 : 'text-muted-foreground hover:bg-muted/30'
 )}
 >
 Monthly
 </button>
 </div>

 <Button
 onClick={handleWeeklySync}
 disabled={isCalculating}
 className="gap-2"
 >
 <RefreshCw className={cn('h-4 w-4', isCalculating && 'animate-spin')} />
 {isCalculating ? 'Syncing…' : 'Weekly Sync'}
 </Button>

 <Button
 onClick={onExport}
 variant="outline"
 className="gap-2"
 >
 <Download className="h-4 w-4" />
 Export
 </Button>
 </div>
 )
}
