'use client'

import { useState } from 'react'
import { Package } from '@/lib/lucide-icons'
import { EmptyState } from '@/components/ui/empty-state'
import { useStorageLedger } from '@/hooks/useStorageLedger'
import { StorageLedgerHeader } from './storage-ledger/StorageLedgerHeader'
import { StorageLedgerStats } from './storage-ledger/StorageLedgerStats'
import { StorageLedgerTable } from './storage-ledger/StorageLedgerTable'

interface StorageLedgerTabProps {
  viewMode: 'live' | 'point-in-time'
  selectedDate: string
  searchQuery: string
  filters: Record<string, unknown>
  showFilters: boolean
  setShowFilters: (show: boolean) => void
  setFilters: (filters: Record<string, unknown>) => void
  warehouses: { id: string; name: string }[]
}

export function StorageLedgerTab({
  viewMode: _viewMode,
  selectedDate: _selectedDate,
  searchQuery,
  filters,
  showFilters: _showFilters,
  setShowFilters: _setShowFilters,
  setFilters: _setFilters,
  warehouses: _warehouses
}: StorageLedgerTabProps) {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [aggregationView, setAggregationView] = useState<'weekly' | 'monthly'>('weekly')

  // Use custom hook for data management
  const { entries, summary, loading, error, exportData, refetch } = useStorageLedger({
    warehouse: filters.warehouse,
    startDate: dateRange.start,
    endDate: dateRange.end,
    search: searchQuery,
    includeCosts: true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={Package}
        title="Error Loading Data"
        description={error}
      />
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No Storage Data Found"
        description="No storage entries available for the selected date range."
      />
    )
  }

  return (
    <div className="space-y-6">
      <StorageLedgerHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        aggregationView={aggregationView}
        onAggregationChange={setAggregationView}
        onExport={exportData}
        onRefresh={refetch}
      />
      
      <StorageLedgerStats summary={summary} />
      
      <StorageLedgerTable 
        entries={entries} 
        searchQuery={searchQuery}
      />
    </div>
  )
}