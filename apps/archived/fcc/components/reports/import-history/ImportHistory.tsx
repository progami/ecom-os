'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Database, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ImportHistoryProps, ImportHistoryItem as ImportItem, ImportFilters } from './types'
import { ImportHistoryItem } from './ImportHistoryItem'
import { ImportHistoryFilter } from './ImportHistoryFilter'
import { cn } from '@/lib/utils'

export function ImportHistory({
  reportType,
  onSelectImport,
  onDeleteImport,
  onCompareImports,
  showActions = true,
  maxItems = 10,
  className
}: ImportHistoryProps) {
  const [imports, setImports] = useState<ImportItem[]>([])
  const [filteredImports, setFilteredImports] = useState<ImportItem[]>([])
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ImportFilters>({})
  
  // Fetch import history
  const fetchImports = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (reportType) params.set('reportType', reportType)
      params.set('limit', maxItems.toString())
      
      const response = await fetch(`/api/v1/reports/import-history?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch import history')
      }
      
      const data = await response.json()
      
      // Transform the data to match our interface
      const transformedImports = (data.imports || []).map((imp: any) => ({
        ...imp,
        periodStart: imp.periodStart ? new Date(imp.periodStart) : null,
        periodEnd: new Date(imp.periodEnd),
        importedAt: new Date(imp.importedAt)
      }))
      
      setImports(transformedImports)
      setFilteredImports(transformedImports)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load import history')
      console.error('Error fetching imports:', err)
    } finally {
      setLoading(false)
    }
  }, [reportType, maxItems])
  
  useEffect(() => {
    fetchImports()
  }, [fetchImports])
  
  // Apply filters
  useEffect(() => {
    let filtered = [...imports]
    
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
        item.importedBy.toLowerCase().includes(searchLower)
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
    
    setFilteredImports(filtered)
  }, [imports, filters])
  
  const handleSelectImport = (importId: string, selected: boolean) => {
    const newSelected = new Set(selectedImports)
    if (selected) {
      newSelected.add(importId)
    } else {
      newSelected.delete(importId)
    }
    setSelectedImports(newSelected)
  }
  
  const handleDeleteImport = async (importId: string) => {
    if (!onDeleteImport) return
    
    try {
      await onDeleteImport(importId)
      setImports(prev => prev.filter(item => item.id !== importId))
      setSelectedImports(prev => {
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
    if (!onCompareImports || selectedImports.size < 2) return
    onCompareImports(Array.from(selectedImports))
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
          onClick={fetchImports}
          className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }
  
  const hasMultipleReportTypes = new Set(imports.map(i => i.reportType)).size > 1
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-200">Import History</h3>
          <span className="text-sm text-gray-500">({filteredImports.length} imports)</span>
        </div>
        
        {onCompareImports && selectedImports.size >= 2 && (
          <button
            onClick={handleCompare}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Compare {selectedImports.size} imports
          </button>
        )}
      </div>
      
      {/* Filters */}
      {imports.length > 0 && (
        <ImportHistoryFilter
          onFilterChange={setFilters}
          reportTypes={hasMultipleReportTypes ? Array.from(new Set(imports.map(i => i.reportType))) : undefined}
        />
      )}
      
      {/* Import List */}
      {filteredImports.length === 0 ? (
        <div className="bg-secondary border border-default rounded-xl p-8 text-center">
          <Upload className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-1">No imports found</p>
          <p className="text-sm text-gray-500">
            {filters.search || filters.reportType || filters.status 
              ? 'Try adjusting your filters' 
              : 'Import data to see history here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredImports.map(item => (
            <ImportHistoryItem
              key={item.id}
              item={item}
              onView={onSelectImport}
              onDelete={showActions ? handleDeleteImport : undefined}
              onSelect={onCompareImports ? handleSelectImport : undefined}
              isSelected={selectedImports.has(item.id)}
              showReportType={!reportType || hasMultipleReportTypes}
            />
          ))}
        </div>
      )}
    </div>
  )
}