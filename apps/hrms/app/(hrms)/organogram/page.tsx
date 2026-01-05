'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HierarchyApi, HierarchyEmployee } from '@/lib/api-client'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { OrgChartIcon, SpinnerIcon, SearchIcon, XIcon, RefreshIcon } from '@/components/ui/Icons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { OrgChart } from '@/components/organogram/OrgChart'

interface HierarchyData {
  items: HierarchyEmployee[]
  currentEmployeeId: string | null
  managerChainIds: string[]
  directReportIds: string[]
}

function OrganogramContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const searchQuery = searchParams.get('q') ?? ''

  const setSearchQuery = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.replace(`/organogram?${params.toString()}`, { scroll: false })
  }

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const hierarchy = await HierarchyApi.getFull()
      setHierarchyData(hierarchy)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load org chart'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredEmployees = hierarchyData?.items.filter((emp) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      emp.firstName.toLowerCase().includes(query) ||
      emp.lastName.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query) ||
      emp.position.toLowerCase().includes(query) ||
      emp.employeeId.toLowerCase().includes(query)
    )
  }) ?? []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SpinnerIcon className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Alert variant="error" className="max-w-md mb-4">
          {error}
        </Alert>
        <Button onClick={() => fetchData()}>Retry</Button>
      </div>
    )
  }

  return (
    <Card>
      <div className="mb-6 space-y-4">
        {/* Search & Refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, department, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6"
              >
                <XIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredEmployees.length} of {hierarchyData?.items.length} employees
          </p>
        )}
      </div>

      <OrgChart
        employees={filteredEmployees}
        currentEmployeeId={hierarchyData?.currentEmployeeId ?? null}
        managerChainIds={hierarchyData?.managerChainIds ?? []}
        directReportIds={hierarchyData?.directReportIds ?? []}
      />
    </Card>
  )
}

export default function OrganogramPage() {
  return (
    <>
      <ListPageHeader
        title="Organization Chart"
        description="View company structure"
        icon={<OrgChartIcon className="h-6 w-6 text-white" />}
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <SpinnerIcon className="h-8 w-8 animate-spin text-accent" />
          </div>
        }
      >
        <OrganogramContent />
      </Suspense>
    </>
  )
}
