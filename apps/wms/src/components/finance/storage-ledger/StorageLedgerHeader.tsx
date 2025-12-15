import { useState, useMemo } from 'react'
import { Download, RefreshCw, Trash2 } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageTabs } from '@/components/ui/page-tabs'

interface StorageLedgerHeaderProps {
 aggregationView: 'weekly' | 'monthly'
 onAggregationChange: (view: 'weekly' | 'monthly') => void
 onExport: () => void
 onRefresh?: () => void
 isAdmin?: boolean
}

export function StorageLedgerHeader({
 aggregationView,
 onAggregationChange,
 onExport,
 onRefresh,
 isAdmin = false,
}: StorageLedgerHeaderProps) {
 const [isCalculating, setIsCalculating] = useState(false)
 const [isDeleting, setIsDeleting] = useState(false)

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

 const handleDeleteAll = async () => {
 if (isDeleting) return

 const confirmed = window.confirm('Are you sure you want to delete ALL storage ledger entries? This cannot be undone.')
 if (!confirmed) return

 setIsDeleting(true)
 try {
 const response = await fetch('/api/finance/storage-ledger', {
 method: 'DELETE',
 })

 if (!response.ok) {
 throw new Error(`Delete failed: ${response.status}`)
 }

 const result = await response.json()
 toast.success(result.message)

 if (onRefresh) {
 onRefresh()
 }
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Unknown error'
 toast.error(`Delete failed: ${message}`)
 } finally {
 setIsDeleting(false)
 }
 }

 const aggregationTabs = useMemo(() => [
   { value: 'weekly', label: 'Weekly' },
   { value: 'monthly', label: 'Monthly' },
 ], [])

 return (
   <div className="flex flex-wrap items-center gap-3">
     <PageTabs
       tabs={aggregationTabs}
       value={aggregationView}
       onChange={(value) => onAggregationChange(value as 'weekly' | 'monthly')}
       variant="pills"
     />

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

 {isAdmin && (
 <Button
 onClick={handleDeleteAll}
 disabled={isDeleting}
 variant="destructive"
 className="gap-2"
 >
 <Trash2 className={cn('h-4 w-4', isDeleting && 'animate-pulse')} />
 {isDeleting ? 'Deleting…' : 'Clear All'}
 </Button>
 )}
 </div>
 )
}
