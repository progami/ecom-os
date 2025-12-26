'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CasesApi, type Case } from '@/lib/api-client'
import { ExclamationTriangleIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/Badge'
import { TabButton } from '@/components/ui/TabButton'

function labelCaseType(type: string) {
  return type.replaceAll('_', ' ').toLowerCase()
}

type CaseTab = 'ALL' | 'VIOLATION' | 'GRIEVANCE' | 'INVESTIGATION' | 'INCIDENT' | 'REQUEST' | 'OTHER'
const CASE_TABS: CaseTab[] = ['ALL', 'VIOLATION', 'GRIEVANCE', 'INVESTIGATION', 'INCIDENT', 'REQUEST', 'OTHER']

export function CasesClientPage(props: { initialTab?: string; initialQuery?: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Case[]>([])
  const [q, setQ] = useState(props.initialQuery ?? '')
  const [activeTab, setActiveTab] = useState<CaseTab>(() => {
    const raw = (props.initialTab || 'ALL').toUpperCase()
    return CASE_TABS.includes(raw as CaseTab) ? (raw as CaseTab) : 'ALL'
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const caseType = activeTab === 'ALL' ? undefined : activeTab
      const data = await CasesApi.list({ q, caseType })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load cases', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Cases"
        description="HR case management and investigations"
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        action={(
          <Button
            href={activeTab === 'VIOLATION' ? '/cases/violations/add' : '/cases/add'}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            {activeTab === 'VIOLATION' ? 'Raise Violation' : 'New Case'}
          </Button>
        )}
      />

      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <TabButton active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} icon={ExclamationTriangleIcon}>
            All
          </TabButton>
          <TabButton active={activeTab === 'VIOLATION'} onClick={() => setActiveTab('VIOLATION')} icon={ExclamationTriangleIcon}>
            Violations
          </TabButton>
          <TabButton active={activeTab === 'GRIEVANCE'} onClick={() => setActiveTab('GRIEVANCE')} icon={ExclamationTriangleIcon}>
            Grievances
          </TabButton>
          <TabButton active={activeTab === 'INVESTIGATION'} onClick={() => setActiveTab('INVESTIGATION')} icon={ExclamationTriangleIcon}>
            Investigations
          </TabButton>
          <TabButton active={activeTab === 'INCIDENT'} onClick={() => setActiveTab('INCIDENT')} icon={ExclamationTriangleIcon}>
            Incidents
          </TabButton>
          <TabButton active={activeTab === 'REQUEST'} onClick={() => setActiveTab('REQUEST')} icon={ExclamationTriangleIcon}>
            Requests
          </TabButton>
          <TabButton active={activeTab === 'OTHER'} onClick={() => setActiveTab('OTHER')} icon={ExclamationTriangleIcon}>
            Other
          </TabButton>
        </div>

        <Card padding="md">
          <SearchForm value={q} onChange={setQ} onSubmit={load} placeholder="Search cases by title, description, or case number..." />
        </Card>

        <ResultsCount count={items.length} singular="case" plural="cases" loading={loading} />

        <Table>
          <TableHeader>
            <TableHead>Case</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignee</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={4}
                icon={<ExclamationTriangleIcon className="h-10 w-10" />}
                title="No cases found"
                description="Create your first case to start tracking issues and investigations."
                action={{ label: 'New Case', href: '/cases/add' }}
              />
            ) : (
              items.map((c) => (
                <TableRow key={c.id} onClick={() => router.push(`/cases/${c.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">#{c.caseNumber} • {c.title}</p>
                      {c.subjectEmployee && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Subject: {c.subjectEmployee.firstName} {c.subjectEmployee.lastName}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{labelCaseType(c.caseType)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

