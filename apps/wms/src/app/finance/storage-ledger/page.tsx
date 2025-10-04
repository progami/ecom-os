'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DollarSign, Package, Calendar } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { EmptyState } from '@/components/ui/empty-state'
import { StorageLedgerHeader } from '@/components/finance/storage-ledger/StorageLedgerHeader'
import { StorageLedgerStats } from '@/components/finance/storage-ledger/StorageLedgerStats'
import { StorageLedgerTable, type StorageLedgerColumnFilters } from '@/components/finance/storage-ledger/StorageLedgerTable'
import { useStorageLedger } from '@/hooks/useStorageLedger'
import { format } from 'date-fns'

export default function StorageLedgerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', window.location.origin + '/finance/storage-ledger')
      window.location.href = url.toString()
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <StorageLedgerContent />
      </PageContainer>
    </DashboardLayout>
  )
}

function StorageLedgerContent() {
  const [aggregationView, setAggregationView] = useState<'weekly' | 'monthly'>('weekly')
  const [filters, setFilters] = useState<StorageLedgerColumnFilters>(createDefaultFilters)
  const [dateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  const { entries, summary, loading, error, exportData, refetch } = useStorageLedger({
    startDate: dateRange.start,
    endDate: dateRange.end,
    includeCosts: true,
  })

  const filteredEntries = useMemo(() => filterEntries(entries, filters), [entries, filters])

  const headerActions = (
    <StorageLedgerHeader
      aggregationView={aggregationView}
      onAggregationChange={setAggregationView}
      onExport={exportData}
      onRefresh={refetch}
    />
  )

  return (
    <>
      <PageHeaderSection
        title="Storage Ledger"
        description="Finance"
        icon={Calendar}
        actions={headerActions}
      />
      <PageContent>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <EmptyState
          icon={Package}
          title="Error Loading Data"
          description={error}
        />
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Storage Data Found"
          description="No storage entries available for the selected criteria."
        />
      ) : (
        <div className="space-y-6">
          {summary && <StorageLedgerStats summary={summary} />}
          <StorageLedgerTable
            entries={filteredEntries}
            aggregationView={aggregationView}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>
      )}
      </PageContent>
    </>
  )
}

function createDefaultFilters(): StorageLedgerColumnFilters {
  return {
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
    totalCostMax: ''
  }
}

function filterEntries(entries: ReturnType<typeof useStorageLedger>['entries'], filters: StorageLedgerColumnFilters) {
  const parseNumber = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }

  const cartonsMin = parseNumber(filters.cartonsMin)
  const cartonsMax = parseNumber(filters.cartonsMax)
  const rateMin = parseNumber(filters.rateMin)
  const rateMax = parseNumber(filters.rateMax)
  const totalCostMin = parseNumber(filters.totalCostMin)
  const totalCostMax = parseNumber(filters.totalCostMax)

  return entries.filter(entry => {
    if (filters.warehouseCodes.length > 0 && !filters.warehouseCodes.includes(entry.warehouseCode)) {
      return false
    }

    if (filters.skuCodes.length > 0 && !filters.skuCodes.includes(entry.skuCode)) {
      return false
    }

    if (filters.weekEnding) {
      const weekLabel = format(new Date(entry.weekEndingDate), 'PP').toLowerCase()
      if (!weekLabel.includes(filters.weekEnding.toLowerCase())) {
        return false
      }
    }

    if (filters.description) {
      const description = entry.skuDescription?.toLowerCase() ?? ''
      if (!description.includes(filters.description.toLowerCase())) {
        return false
      }
    }

    if (filters.batch) {
      if (!entry.batchLot.toLowerCase().includes(filters.batch.toLowerCase())) {
        return false
      }
    }

    if (filters.status.length > 0) {
      const status = entry.isCostCalculated ? 'CALCULATED' : 'PENDING'
      if (!filters.status.includes(status)) {
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
}
