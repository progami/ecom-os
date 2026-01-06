'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { MeApi, PoliciesApi, type Policy } from '@/lib/api-client'
import { DocumentIcon, PlusIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SearchForm } from '@/components/ui/SearchForm'
import { DataTable, type FilterOption } from '@/components/ui/DataTable'
import { ResultsCount } from '@/components/ui/table'
import { TableEmptyContent } from '@/components/ui/EmptyState'

const REGION_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'All Regions' },
  { value: 'KANSAS_US', label: 'US (Kansas)' },
  { value: 'PAKISTAN', label: 'Pakistan' },
]

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGION_OPTIONS.map((o) => [o.value, o.label])
)

export default function PoliciesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Policy[]>([])
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [canManagePolicies, setCanManagePolicies] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await PoliciesApi.list({ q })
      setItems(data.items)
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

  useEffect(() => {
    async function loadPermissions() {
      try {
        const me = await MeApi.get()
        setCanManagePolicies(Boolean(me.isSuperAdmin || me.isHR))
      } catch {
        setCanManagePolicies(false)
      }
    }
    loadPermissions()
  }, [])

  // Get unique categories from items
  const categoryOptions = useMemo<FilterOption[]>(() => {
    const categories = [...new Set(items.map((p) => p.category).filter(Boolean))]
    return categories.map((c) => ({ value: c, label: c }))
  }, [items])

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.region && item.region !== filters.region) return false
      if (filters.status && item.status !== filters.status) return false
      if (filters.category && item.category !== filters.category) return false
      return true
    })
  }, [items, filters])

  const columns = useMemo<ColumnDef<Policy>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.title}</p>
            {row.original.summary && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {row.original.summary}
              </p>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        meta: {
          filterKey: 'category',
          filterOptions: categoryOptions,
        },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'region',
        header: 'Region',
        meta: {
          filterKey: 'region',
          filterOptions: REGION_OPTIONS,
        },
        cell: ({ getValue }) => {
          const region = getValue<string>()
          return (
            <span className="text-muted-foreground">
              {REGION_LABELS[region] ?? region}
            </span>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'version',
        header: 'Version',
        cell: ({ getValue }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            v{getValue<number>()}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          filterKey: 'status',
          filterOptions: STATUS_OPTIONS,
        },
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
        enableSorting: true,
      },
    ],
    [categoryOptions]
  )

  const handleRowClick = useCallback(
    (policy: Policy) => {
      router.push(`/policies/${policy.id}`)
    },
    [router]
  )

  return (
    <>
      <ListPageHeader
        title="Policies"
        description="Manage company policies and guidelines"
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
        action={
          canManagePolicies ? (
            <Button href="/policies/add" icon={<PlusIcon className="h-4 w-4" />}>
              Add Policy
            </Button>
          ) : null
        }
      />

      <div className="space-y-4">
        <Card padding="md">
          <SearchForm
            value={q}
            onChange={setQ}
            onSubmit={load}
            placeholder="Search policies by title..."
          />
        </Card>

        <ResultsCount
          count={filteredItems.length}
          singular="policy"
          plural="policies"
          loading={loading}
        />

        <DataTable
          columns={columns}
          data={filteredItems}
          loading={loading}
          skeletonRows={5}
          onRowClick={handleRowClick}
          filters={filters}
          onFilterChange={setFilters}
          emptyState={
            <TableEmptyContent
              icon={<DocumentIcon className="h-10 w-10" />}
              title="No policies found"
              action={{ label: 'Add your first policy', href: '/policies/add' }}
            />
          }
        />
      </div>
    </>
  )
}
