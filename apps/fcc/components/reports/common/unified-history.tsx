'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Database, AlertCircle, Cloud, FileSpreadsheet, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ImportHistoryItem } from '../import-history/ImportHistoryItem'
import { ImportHistoryFilter } from '../import-history/ImportHistoryFilter'
import { ImportHistoryItem as ImportItem, ImportFilters, ReportType } from '../import-history/types'

export interface UnifiedHistoryItem extends ImportItem {
  isApiData?: boolean
  fetchedAt?: Date
}

interface UnifiedHistoryProps {
  reportType?: ReportType
  onSelectItem?: (item: UnifiedHistoryItem) => void
  onDeleteImport?: (importId: string) => Promise<void>
  onCompareItems?: (itemIds: string[]) => void
  showActions?: boolean
  maxItems?: number
  className?: string
  includeApiHistory?: boolean
}

export function UnifiedHistory({
  reportType,
  onSelectItem,
  onDeleteImport,
  onCompareItems,
  showActions = true,
  maxItems = 10,
  className,
  includeApiHistory = true
}: UnifiedHistoryProps) {
  const [items, setItems] = useState<UnifiedHistoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<UnifiedHistoryItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ImportFilters>({})
  
  // Fetch both import history and API fetch history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (reportType) params.set('reportType', reportType)
      params.set('limit', maxItems.toString())
      
      // Fetch import history
      const importResponse = await fetch(`/api/v1/reports/import-history?${params}`)
      if (!importResponse.ok) {
        throw new Error('Failed to fetch import history')
      }
      
      const importData = await importResponse.json()
      const imports = (importData.imports || []).map((imp: any) => ({
        ...imp,
        periodStart: imp.periodStart ? new Date(imp.periodStart) : null,
        periodEnd: new Date(imp.periodEnd),
        importedAt: new Date(imp.importedAt),
        isApiData: false
      }))
      
      let allItems = [...imports]
      
      // If including API history, fetch from localStorage or session storage
      if (includeApiHistory) {
        const apiHistoryKey = `api-history-${reportType || 'all'}`
        const apiHistoryData = localStorage.getItem(apiHistoryKey)
        
        if (apiHistoryData) {
          const apiHistory = JSON.parse(apiHistoryData)
          const apiItems = apiHistory.map((item: any) => ({
            id: `api-${item.timestamp}`,
            reportType: item.reportType || reportType,
            source: 'xero' as const,
            periodStart: item.periodStart ? new Date(item.periodStart) : null,
            periodEnd: new Date(item.periodEnd),
            importedAt: new Date(item.timestamp),
            importedBy: 'API',
            status: 'completed' as const,
            isApiData: true,
            fetchedAt: new Date(item.timestamp),
            metadata: item.metadata || {}
          }))
          
          allItems = [...allItems, ...apiItems]
        }
      }
      
      // Sort by date (newest first)
      allItems.sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())
      
      // Limit items
      allItems = allItems.slice(0, maxItems)
      
      setItems(allItems)
      setFilteredItems(allItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
      console.error('Error fetching history:', err)
    } finally {
      setLoading(false)
    }
  }, [reportType, maxItems, includeApiHistory])
  
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])
  
  // Apply filters
  useEffect(() => {
    let filtered = [...items]
    
    if (filters.reportType) {
      filtered = filtered.filter(item => item.reportType === filters.reportType)
    }
    
    if (filters.status) {
      filtered = filtered.filter(item => item.status === filters.status)
    }
    
    if (filters.source) {
      filtered = filtered.filter(item => item.source === filters.source)
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(item => 
        item.fileName?.toLowerCase().includes(searchLower) ||
        item.importedBy.toLowerCase().includes(searchLower) ||
        (item.isApiData && 'api'.includes(searchLower))
      )
    }
    
    if (filters.dateFrom) {
      filtered = filtered.filter(item => 
        new Date(item.importedAt) >= filters.dateFrom!
      )
    }
    
    if (filters.dateTo) {
      filtered = filtered.filter(item => 
        new Date(item.importedAt) <= filters.dateTo!
      )
    }
    
    setFilteredItems(filtered)
  }, [items, filters])
  
  const handleSelectItem = (itemId: string, selected: boolean) => {
    const newSelected = new Set(selectedItems)
    if (selected) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }
  
  const handleDeleteImport = async (importId: string) => {
    if (!onDeleteImport) return
    
    try {
      await onDeleteImport(importId)
      setItems(prev => prev.filter(item => item.id !== importId))
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(importId)
        return newSet
      })
    } catch (error) {
      console.error('Failed to delete import:', error)
      throw error
    }
  }
  
  const handleCompare = () => {
    if (!onCompareItems || selectedItems.size < 2) return
    onCompareItems(Array.from(selectedItems))
  }
  
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="animate-pulse">
          <div className="h-10 bg-slate-800 rounded-lg mb-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl mb-3" />
          ))}
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={cn("bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center", className)}>
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchHistory}
          className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }
  
  const hasMultipleReportTypes = new Set(items.map(i => i.reportType)).size > 1
  const hasApiData = items.some(i => i.isApiData)
  const hasImports = items.some(i => !i.isApiData)
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-200">Data History</h3>
          <span className="text-sm text-gray-500">({filteredItems.length} items)</span>
        </div>
        
        {onCompareItems && selectedItems.size >= 2 && (
          <button
            onClick={handleCompare}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Compare {selectedItems.size} items
          </button>
        )}
      </div>
      
      {/* Filters */}
      {items.length > 0 && (
        <ImportHistoryFilter
          onFilterChange={setFilters}
          reportTypes={hasMultipleReportTypes ? Array.from(new Set(items.map(i => i.reportType))) : undefined}
        />
      )}
      
      {/* Legend for source types */}
      {hasApiData && hasImports && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Cloud className="h-3 w-3" />
            <span>API Fetch</span>
          </div>
          <div className="flex items-center gap-1">
            <FileSpreadsheet className="h-3 w-3" />
            <span>File Import</span>
          </div>
        </div>
      )}
      
      {/* History List */}
      {filteredItems.length === 0 ? (
        <div className="bg-secondary border border-default rounded-xl p-8 text-center">
          <Upload className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-1">No data history found</p>
          <p className="text-sm text-gray-500">
            {filters.search || filters.reportType || filters.status 
              ? 'Try adjusting your filters' 
              : 'Import data or fetch from API to see history here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={cn(
                "relative transition-all duration-200",
                item.isApiData && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-brand-blue before:rounded-l-lg"
              )}
            >
              {item.isApiData ? (
                // Custom rendering for API data
                <div className="bg-secondary border border-default rounded-xl p-4 hover:bg-secondary/80 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Cloud className="h-5 w-5 text-brand-blue mt-0.5" />
                      <div>
                        <p className="font-medium text-white">API Fetch</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {item.reportType} • {new Date(item.periodEnd).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {new Date(item.importedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {onSelectItem && (
                      <button
                        onClick={() => onSelectItem(item)}
                        className="px-3 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue text-sm rounded-lg transition-colors"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Regular import item
                <ImportHistoryItem
                  item={item}
                  onView={onSelectItem}
                  onDelete={showActions ? handleDeleteImport : undefined}
                  onSelect={onCompareItems ? handleSelectItem : undefined}
                  isSelected={selectedItems.has(item.id)}
                  showReportType={!reportType || hasMultipleReportTypes}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}