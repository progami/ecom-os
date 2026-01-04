'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { CasesApi, type Case } from '@/lib/api-client'
import { ExclamationTriangleIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import { DataTable } from '@/components/ui/DataTable'
import { ResultsCount } from '@/components/ui/Table'
import { TableEmptyContent } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/Badge'
import { TabButton } from '@/components/ui/TabButton'

function labelCaseType(type: string) {
  return type.replaceAll('_', ' ').toLowerCase()
}

type CaseTab = 'ALL' | 'VIOLATION'
const CASE_TABS: CaseTab[] = ['ALL', 'VIOLATION']

export function CasesClientPage(props: { initialTab?: string; initialQuery?: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Case[]>([])
  const [q, setQ] = useState(props.initialQuery ?? '')
  const [activeTab, setActiveTab] = useState<CaseTab>(() => {
    const raw = (props.initialTab ?? 'ALL').toUpperCase()
    return CASE_TABS.includes(raw as CaseTab) ? (raw as CaseTab) : 'ALL'
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const caseType = activeTab === 'ALL' ? undefined : activeTab
      const data = await CasesApi.list({ q, caseType })
      setItems(data.items)
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

  const columns = useMemo<ColumnDef<Case>[]>(
    () => [
      {
        accessorKey: 'caseNumber',
        header: 'Case',
        cell: ({ row }) => {
          const c = row.original
          return (
            <div>
              <p className="font-medium text-foreground">#{c.caseNumber} • {c.title}</p>
              {c.subjectEmployee && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subject: {c.subjectEmployee.firstName} {c.subjectEmployee.lastName}
                </p>
              )}
            </div>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'caseType',
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue<string>()
          return <span className="text-muted-foreground capitalize">{labelCaseType(type)}</span>
        },
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return <StatusBadge status={status} />
        },
        enableSorting: true,
      },
      {
        accessorFn: (row) =>
          row.assignedTo ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}` : '',
        id: 'assignee',
        header: 'Assignee',
        cell: ({ getValue }) => {
          const value = getValue<string>()
          return <span className="text-muted-foreground">{value || '—'}</span>
        },
        enableSorting: true,
      },
    ],
    []
  )

  const handleRowClick = useCallback(
    (caseItem: Case) => {
      router.push(`/cases/${caseItem.id}`)
    },
    [router]
  )

  return (
    <>
      <ListPageHeader
        title="Cases"
        description="HR case management and investigations"
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        action={
          <Button
            href="/cases/violations/add"
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Raise Violation
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <TabButton active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} icon={ExclamationTriangleIcon}>
            All
          </TabButton>
          <TabButton active={activeTab === 'VIOLATION'} onClick={() => setActiveTab('VIOLATION')} icon={ExclamationTriangleIcon}>
            Violations
          </TabButton>
        </div>

        <Card padding="md">
          <SearchForm value={q} onChange={setQ} onSubmit={load} placeholder="Search cases by title, description, or case number..." />
        </Card>

        <ResultsCount count={items.length} singular="case" plural="cases" loading={loading} />

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          skeletonRows={6}
          onRowClick={handleRowClick}
          emptyState={
            <TableEmptyContent
              icon={<ExclamationTriangleIcon className="h-10 w-10" />}
              title="No cases found"
              description="Raise a violation to start tracking employee issues."
              action={{ label: 'Raise Violation', href: '/cases/violations/add' }}
            />
          }
        />
      </div>
    </>
  )
}
