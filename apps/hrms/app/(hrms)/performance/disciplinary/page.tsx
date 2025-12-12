'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DisciplinaryActionsApi, type DisciplinaryAction } from '@/lib/api-client'
import { ShieldExclamationIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  ATTENDANCE: 'Attendance',
  CONDUCT: 'Conduct',
  PERFORMANCE: 'Performance',
  POLICY_VIOLATION: 'Policy Violation',
  SAFETY: 'Safety',
  HARASSMENT: 'Harassment',
  INSUBORDINATION: 'Insubordination',
  THEFT_FRAUD: 'Theft/Fraud',
  SUBSTANCE_ABUSE: 'Substance Abuse',
  OTHER: 'Other',
}

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-slate-100 text-slate-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  MAJOR: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  UNDER_INVESTIGATION: 'Investigating',
  ACTION_TAKEN: 'Action Taken',
  APPEALED: 'Appealed',
  CLOSED: 'Closed',
  DISMISSED: 'Dismissed',
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorClass = SEVERITY_COLORS[severity] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {SEVERITY_LABELS[severity] || severity}
    </span>
  )
}

function TableRowSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
          <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
          <td className="px-4 py-4"><div className="h-5 bg-slate-200 rounded w-20" /></td>
        </tr>
      ))}
    </>
  )
}

export default function DisciplinaryActionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<DisciplinaryAction[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await DisciplinaryActionsApi.list({ q })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching disciplinary actions:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      <ListPageHeader
        title="Disciplinary Actions"
        description="Track violations and disciplinary records"
        icon={<ShieldExclamationIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/performance/disciplinary/add" icon={<PlusIcon className="h-4 w-4" />}>
            Report Violation
          </Button>
        }
      />

      <div className="space-y-6">
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search by employee name or description..."
          />
        </Card>

        <ResultsCount
          count={items.length}
          singular="record"
          plural="records"
          loading={loading}
        />

        <Table>
          <TableHeader>
            <TableHead>Employee</TableHead>
            <TableHead>Violation Type</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Incident Date</TableHead>
            <TableHead>Status</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowSkeleton />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                icon={<ShieldExclamationIcon className="h-10 w-10" />}
                title="No disciplinary records found"
              />
            ) : (
              items.map((d) => (
                <TableRow
                  key={d.id}
                  onClick={() => router.push(`/performance/disciplinary/${d.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {d.employee?.firstName} {d.employee?.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{d.employee?.department}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {VIOLATION_TYPE_LABELS[d.violationType] || d.violationType}
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={d.severity} />
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(d.incidentDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={STATUS_LABELS[d.status] || d.status} />
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
