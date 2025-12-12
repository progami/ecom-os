'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeavePoliciesApi, type LeavePolicy } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
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
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

const REGION_LABELS: Record<string, string> = {
  KANSAS_US: 'Kansas (USA)',
  PAKISTAN: 'Pakistan',
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO',
  PARENTAL: 'Parental Leave',
  BEREAVEMENT_IMMEDIATE: 'Bereavement (Immediate)',
  BEREAVEMENT_EXTENDED: 'Bereavement (Extended)',
  JURY_DUTY: 'Jury Duty',
}

export default function LeavePoliciesPage() {
  const router = useRouter()
  const [items, setItems] = useState<LeavePolicy[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await LeavePoliciesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load leave policies', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Leave Policies"
        description="View leave entitlements by region"
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
      />

      <div className="space-y-6">
        {/* Search */}
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search leave policies..."
          />
        </Card>

        {/* Results count */}
        <ResultsCount
          count={items.length}
          singular="leave policy"
          plural="leave policies"
          loading={loading}
        />

        {/* Table */}
        <Table>
          <TableHeader>
            <TableHead>Leave Type</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Entitled Days</TableHead>
            <TableHead className="text-center">Paid</TableHead>
            <TableHead className="text-right">Carryover Max</TableHead>
            <TableHead>Status</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                icon={<DocumentIcon className="h-10 w-10" />}
                title="No leave policies found"
              />
            ) : (
              items.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => router.push(`/policies/${p.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {LEAVE_TYPE_LABELS[p.leaveType] || p.leaveType}
                      </p>
                      {p.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {REGION_LABELS[p.region] || p.region}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {p.entitledDays}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.isPaid ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        Unpaid
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {p.carryoverMax != null ? `${p.carryoverMax} days` : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
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
