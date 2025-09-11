import { useState } from 'react'
import { Calendar, Download, RefreshCw } from '@/lib/lucide-icons'
import { toast } from 'react-hot-toast'

interface StorageLedgerHeaderProps {
  dateRange: {
    start: string
    end: string
  }
  onDateRangeChange: (range: { start: string; end: string }) => void
  aggregationView: 'weekly' | 'monthly'
  onAggregationChange: (view: 'weekly' | 'monthly') => void
  onExport: () => void
  onRefresh?: () => void
}

export function StorageLedgerHeader({
  dateRange,
  onDateRangeChange,
  aggregationView,
  onAggregationChange,
  onExport,
  onRefresh
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
      
      // Refresh the data
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Weekly sync error:', error)
      toast.error(`Weekly sync failed: ${error.message}`)
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center gap-2 border rounded-lg">
          <button
            onClick={() => onAggregationChange('weekly')}
            className={`px-3 py-2 ${
              aggregationView === 'weekly' 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            } rounded-l-lg transition-colors`}
          >
            Weekly
          </button>
          <button
            onClick={() => onAggregationChange('monthly')}
            className={`px-3 py-2 ${
              aggregationView === 'monthly' 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            } rounded-r-lg transition-colors`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleWeeklySync}
          disabled={isCalculating}
          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
            isCalculating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isCalculating ? 'animate-spin' : ''}`} />
          {isCalculating ? 'Syncing...' : 'Weekly Sync'}
        </button>
        
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
    </div>
  )
}