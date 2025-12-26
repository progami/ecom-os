'use client'

import { useCallback, useEffect, useState } from 'react'
import { ResourcesApi, type Resource } from '@/lib/api-client'
import {
  FolderIcon,
  PlusIcon,
  ExternalLinkIcon,
  EnvelopeIcon,
  PhoneIcon,
  StarFilledIcon,
  PencilIcon,
  UsersIcon,
  ChartBarIcon,
  DocumentIcon,
  BellIcon,
  ClipboardDocumentCheckIcon,
} from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchForm } from '@/components/ui/SearchForm'
import { ResultsCount } from '@/components/ui/Table'
import { TableEmptyState } from '@/components/ui/EmptyState'

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FolderIcon; color: string }> = {
  ACCOUNTING: { label: 'Accounting', icon: ChartBarIcon, color: 'bg-emerald-100 text-emerald-700' },
  LEGAL: { label: 'Legal', icon: DocumentIcon, color: 'bg-purple-100 text-purple-700' },
  DESIGN: { label: 'Design', icon: PencilIcon, color: 'bg-pink-100 text-pink-700' },
  MARKETING: { label: 'Marketing', icon: BellIcon, color: 'bg-orange-100 text-orange-700' },
  IT: { label: 'IT', icon: ClipboardDocumentCheckIcon, color: 'bg-blue-100 text-blue-700' },
  HR: { label: 'HR', icon: UsersIcon, color: 'bg-indigo-100 text-indigo-700' },
  OTHER: { label: 'Other', icon: FolderIcon, color: 'bg-gray-100 text-gray-700' },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarFilledIcon
            key={star}
            className={`h-3.5 w-3.5 ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

function ResourceCard({ resource, onClick }: { resource: Resource; onClick: () => void }) {
  const config = CATEGORY_CONFIG[resource.category] || CATEGORY_CONFIG.OTHER
  const CategoryIcon = config.icon

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Category Icon */}
          <div className={`flex-shrink-0 p-2.5 rounded-lg ${config.color}`}>
            <CategoryIcon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {resource.name}
              </h3>
              {resource.rating && resource.rating > 0 && (
                <StarRating rating={resource.rating} />
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
              {resource.subcategory && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-600">{resource.subcategory}</span>
                </>
              )}
            </div>

            {resource.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {resource.description}
              </p>
            )}

            {/* Contact Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {resource.email && (
                <a
                  href={`mailto:${resource.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">{resource.email}</span>
                </a>
              )}
              {resource.phone && (
                <a
                  href={`tel:${resource.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <PhoneIcon className="h-4 w-4" />
                  <span>{resource.phone}</span>
                </a>
              )}
              {resource.website && (
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">
                    {resource.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResourceCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 min-w-0">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-1/4 mb-3" />
          <div className="h-4 bg-gray-100 rounded w-full mb-2" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    </div>
  )
}

export default function ResourcesPage() {
  const [items, setItems] = useState<Resource[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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

  // Filter by category
  const filteredItems = selectedCategory
    ? items.filter((r) => r.category === selectedCategory)
    : items

  // Get unique categories for filter
  const categories = Array.from(new Set(items.map((r) => r.category)))

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
        {/* Search and Filters */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchForm
                value={q}
                onChange={setQ}
                onSubmit={load}
                placeholder="Search resources by name, category, or description..."
              />
            </div>
          </div>
        </Card>

        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                selectedCategory === null
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({items.length})
            </button>
            {categories.map((cat) => {
              const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER
              const count = items.filter((r) => r.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    selectedCategory === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {config.label} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Results count */}
        <ResultsCount
          count={filteredItems.length}
          singular="resource"
          plural="resources"
          loading={loading}
        />

        {/* Resource Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card padding="lg">
            <TableEmptyState
              colSpan={1}
              icon={<FolderIcon className="h-12 w-12" />}
              title={q || selectedCategory ? 'No resources match your filters' : 'No resources found'}
              action={
                !q && !selectedCategory
                  ? { label: 'Add your first resource', href: '/resources/add' }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredItems.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onClick={() => {
                  // For now, just show the website if available
                  if (resource.website) {
                    window.open(resource.website, '_blank')
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
