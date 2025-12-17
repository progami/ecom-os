'use client'

import { useCallback, useEffect, useState } from 'react'
import { ResourcesApi, type Resource } from '@/lib/api-client'
import { FolderIcon, PlusIcon, ExternalLinkIcon } from '@/components/ui/Icons'
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

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ResourcesApi.list({ q })
      setItems(data.items || [])
    } catch (e) {
      console.error('Failed to load resources', e)
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
        title="Service Providers"
        description="Manage company resources and vendors"
        icon={<FolderIcon className="h-6 w-6 text-white" />}
        action={
          <Button href="/resources/add" icon={<PlusIcon className="h-4 w-4" />}>
            Add Resource
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
            placeholder="Search resources..."
          />
        </Card>

        {/* Results count */}
        <ResultsCount
          count={items.length}
          singular="resource"
          plural="resources"
          loading={loading}
        />

        {/* Table */}
        <Table>
          <TableHeader>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Subcategory</TableHead>
            <TableHead>Website</TableHead>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={5} columns={4} />
            ) : items.length === 0 ? (
              <TableEmptyState
                colSpan={4}
                icon={<FolderIcon className="h-10 w-10" />}
                title="No resources found"
                action={{
                  label: 'Add your first resource',
                  href: '/resources/add',
                }}
              />
            ) : (
              items.map((r) => (
                <TableRow key={r.id} hoverable>
                  <TableCell className="font-medium text-gray-900">{r.name}</TableCell>
                  <TableCell className="text-gray-600">{r.category}</TableCell>
                  <TableCell className="text-gray-500">{r.subcategory || '—'}</TableCell>
                  <TableCell>
                    {r.website ? (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <span className="truncate max-w-[180px]">{r.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
