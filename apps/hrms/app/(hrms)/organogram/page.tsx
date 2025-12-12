'use client'

import { useState, useEffect } from 'react'
import { HierarchyApi, HierarchyEmployee } from '@/lib/api-client'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { OrgChartIcon, SpinnerIcon, SearchIcon } from '@/components/ui/Icons'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { OrgChart } from '@/components/organogram/OrgChart'

interface HierarchyData {
  items: HierarchyEmployee[]
  currentEmployeeId: string | null
  managerChainIds: string[]
  directReportIds: string[]
}

export default function OrganogramPage() {
  const [data, setData] = useState<HierarchyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchHierarchy()
  }, [])

  const fetchHierarchy = async () => {
    try {
      setLoading(true)
      setError(null)
      const hierarchyData = await HierarchyApi.getFull()
      setData(hierarchyData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load org chart'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Filter employees based on search query
  const filteredEmployees = data?.items.filter((emp) => {
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
      <>
        <ListPageHeader
          title="Organization Chart"
          description="View company structure and reporting hierarchy"
          icon={<OrgChartIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex items-center justify-center h-64">
          <SpinnerIcon className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <ListPageHeader
          title="Organization Chart"
          description="View company structure and reporting hierarchy"
          icon={<OrgChartIcon className="h-6 w-6 text-white" />}
        />
        <div className="flex flex-col items-center justify-center h-64">
          <Alert variant="error" className="max-w-md mb-4">
            {error}
          </Alert>
          <Button onClick={fetchHierarchy}>Retry</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <ListPageHeader
        title="Organization Chart"
        description="View company structure and reporting hierarchy"
        icon={<OrgChartIcon className="h-6 w-6 text-white" />}
      />

      <Card>
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, department, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <p className="text-sm text-slate-500 mt-2">
              Showing {filteredEmployees.length} of {data?.items.length ?? 0} employees
            </p>
          )}
        </div>

        {/* Org Chart */}
        <OrgChart
          employees={filteredEmployees}
          currentEmployeeId={data?.currentEmployeeId ?? null}
          managerChainIds={data?.managerChainIds ?? []}
          directReportIds={data?.directReportIds ?? []}
        />
      </Card>
    </>
  )
}
