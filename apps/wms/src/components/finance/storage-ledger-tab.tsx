"use client"

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Package } from '@/lib/lucide-icons'
import { EmptyState } from '@/components/ui/empty-state'
import { useStorageLedger } from '@/hooks/useStorageLedger'
import { StorageLedgerHeader } from './storage-ledger/StorageLedgerHeader'
import { StorageLedgerStats } from './storage-ledger/StorageLedgerStats'
import { StorageLedgerTable } from './storage-ledger/StorageLedgerTable'

interface StorageLedgerTabProps {
  warehouseCode?: string
}

export interface StorageLedgerColumnFilters {
  warehouseCodes: string[]
  skuCodes: string[]
  weekEnding: string
  description: string
  batch: string
  status: Array<'CALCULATED' | 'PENDING'>
  cartonsMin: string
  cartonsMax: string
  rateMin: string
  rateMax: string
  totalCostMin: string
  totalCostMax: string
}

const createDefaultColumnFilters = (): StorageLedgerColumnFilters => ({
  warehouseCodes: [],
  skuCodes: [],
  weekEnding: '',
  description: '',
  batch: '',
  status: [],
  cartonsMin: '',
  cartonsMax: '',
  rateMin: '',
  rateMax: '',
  totalCostMin: '',
  totalCostMax: '',
})

export function StorageLedgerTab({ warehouseCode }: StorageLedgerTabProps) {
  const [dateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [aggregationView, setAggregationView] = useState<'weekly' | 'monthly'>('weekly')
  const [columnFilters, setColumnFilters] = useState<StorageLedgerColumnFilters>(createDefaultColumnFilters)

  const { entries, summary, loading, error, exportData, refetch } = useStorageLedger({
    warehouse: warehouseCode,
    startDate: dateRange.start,
    endDate: dateRange.end,
    includeCosts: true,
  })

  const filteredEntries = useMemo(() => {
    const parseNumber = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? null : parsed
    }

    const cartonsMin = parseNumber(columnFilters.cartonsMin)
    const cartonsMax = parseNumber(columnFilters.cartonsMax)
    const rateMin = parseNumber(columnFilters.rateMin)
    const rateMax = parseNumber(columnFilters.rateMax)
    const totalCostMin = parseNumber(columnFilters.totalCostMin)
    const totalCostMax = parseNumber(columnFilters.totalCostMax)

    return entries.filter(entry => {
      if (columnFilters.warehouseCodes.length > 0 && !columnFilters.warehouseCodes.includes(entry.warehouseCode)) {
        return false
      }

      if (columnFilters.skuCodes.length > 0 && !columnFilters.skuCodes.includes(entry.skuCode)) {
        return false
      }

      if (columnFilters.weekEnding) {
        const weekLabel = format(new Date(entry.weekEndingDate), 'PP').toLowerCase()
        if (!weekLabel.includes(columnFilters.weekEnding.toLowerCase())) {
          return false
        }
      }

      if (columnFilters.description) {
        const description = entry.skuDescription?.toLowerCase() ?? ''
        if (!description.includes(columnFilters.description.toLowerCase())) {
          return false
        }
      }

      if (columnFilters.batch) {
        if (!entry.batchLot.toLowerCase().includes(columnFilters.batch.toLowerCase())) {
          return false
        }
      }

      if (columnFilters.status.length > 0) {
        const status = entry.isCostCalculated ? 'CALCULATED' : 'PENDING'
        if (!columnFilters.status.includes(status)) {
          return false
        }
      }

      if (cartonsMin !== null && entry.closingBalance < cartonsMin) {
        return false
      }
      if (cartonsMax !== null && entry.closingBalance > cartonsMax) {
        return false
      }

      const rate = entry.storageRatePerCarton ? Number(entry.storageRatePerCarton) : null
      if (rateMin !== null && (rate ?? 0) < rateMin) {
        return false
      }
      if (rateMax !== null && (rate ?? 0) > rateMax) {
        return false
      }

      const totalCost = entry.totalStorageCost ? Number(entry.totalStorageCost) : null
      if (totalCostMin !== null && (totalCost ?? 0) < totalCostMin) {
        return false
      }
      if (totalCostMax !== null && (totalCost ?? 0) > totalCostMax) {
        return false
      }

      return true
    })
  }, [entries, columnFilters])

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

  if (filteredEntries.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No Storage Data Found"
        description="No storage entries available for the selected criteria."
      />
    )
  }

  return (
    <div className="space-y-6">
      <StorageLedgerHeader
        aggregationView={aggregationView}
        onAggregationChange={setAggregationView}
        onExport={exportData}
        onRefresh={refetch}
      />

      <StorageLedgerStats summary={summary} />

      <StorageLedgerTable
        entries={filteredEntries}
        aggregationView={aggregationView}
        filters={columnFilters}
        onFilterChange={setColumnFilters}
      />
    </div>
  )
}
