'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PoliciesApi, type Policy } from '@/lib/api-client'
import {
  DocumentIcon,
  PlusIcon,
} from '@/components/ui/Icons'
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
  TableSkeleton,
  ResultsCount,
} from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

export default function PoliciesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Policy[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await PoliciesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load policies', e)
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
        title="Policies"
        description="Manage company policies and guidelines"
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/policies/add" icon={<PlusIcon className="h-4 w-4" />}>
            Add Policy
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Search */}
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search policies by title..."
          />
        </Card>

        {/* Results count */}
        <ResultsCount
          count={items.length}
          singular="policy"
          plural="policies"
          loading={loading}
        />

        {/* Table */}
        <Table>
          <TableHeader>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} columns={4} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={4}
                icon={<DocumentIcon className="h-10 w-10" />}
                title="No policies found"
                action={{
                  label: 'Add your first policy',
                  href: '/policies/add',
                }}
              />
            ) : (
              items.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => router.push(`/policies/${p.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{p.title}</p>
                      {p.summary && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.summary}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{p.category}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      v{p.version}
                    </span>
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
