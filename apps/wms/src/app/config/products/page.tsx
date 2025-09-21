'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package2, Plus, Edit, Trash2, Search, CheckCircle2, Archive, Link2 } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ImportButton } from '@/components/ui/import-button'
import { Button } from '@/components/ui/button'
import { DataTable, Column } from '@/components/common/data-table'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'

interface SKU extends Record<string, unknown> {
  id: string
  skuCode: string
  description: string
  asin: string | null
  packSize: number
  material?: string | null
  unitsPerCarton: number
  unitDimensionsCm: string | null
  unitWeightKg: number | null
  cartonDimensionsCm: string | null
  cartonWeightKg: number | null
  packagingType?: string | null
  isActive: boolean
  _count: {
    inventoryTransactions: number
    warehouseConfigs: number
  }
}

export default function AdminSkusPage() {
  const router = useRouter()
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [skuToDelete, setSkuToDelete] = useState<SKU | null>(null)

  const fetchSkus = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (showInactive) params.append('includeInactive', 'true')

      const response = await fetch(`/api/skus?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch SKUs' }))
        throw new Error(errorData.details || errorData.error || 'Failed to fetch SKUs')
      }
      
      const data = await response.json()
      setSkus(data)
    } catch (_error) {
      // console.error('Error fetching SKUs:', error)
      alert(_error instanceof Error ? _error.message : 'Failed to fetch SKUs')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, showInactive])

  useEffect(() => {
    fetchSkus()
  }, [fetchSkus])

  const handleDeleteClick = useCallback((sku: SKU) => {
    setSkuToDelete(sku)
    setDeleteConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!skuToDelete) return

    try {
      const response = await fetch(`/api/skus?id=${skuToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete SKU')
      
      const result = await response.json()
      alert(result.message)
      await fetchSkus()
    } catch (_error) {
      // console.error('Error deleting SKU:', error)
      alert('Failed to delete SKU')
    }
  }, [fetchSkus, skuToDelete])

  const handleToggleActive = useCallback(async (sku: SKU) => {
    try {
      const response = await fetch(`/api/skus?id=${sku.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sku.isActive })
      })

      if (!response.ok) throw new Error('Failed to update SKU')
      
      await fetchSkus()
    } catch (_error) {
      // console.error('Error updating SKU:', error)
      alert('Failed to update SKU')
    }
  }, [fetchSkus])

  const handleEditSKU = useCallback((skuId: string) => {
    router.push(`/config/products/${skuId}/edit`)
  }, [router])

  const filteredSkus = useMemo(() => skus.filter(sku => {
    if (!showInactive && !sku.isActive) return false
    if (!searchTerm) return true
    
    const search = searchTerm.toLowerCase()
    return (
      sku.skuCode.toLowerCase().includes(search) ||
      sku.description.toLowerCase().includes(search) ||
      (sku.asin && sku.asin.toLowerCase().includes(search))
    )
  }), [skus, showInactive, searchTerm])

  const skuSummary = useMemo(() => {
    const total = filteredSkus.length
    if (total === 0) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        withAsin: 0
      }
    }

    const active = filteredSkus.filter(sku => sku.isActive).length
    const inactive = total - active
    const withAsin = filteredSkus.filter(sku => !!sku.asin).length

    return {
      total,
      active,
      inactive,
      withAsin
    }
  }, [filteredSkus])

  const columns: Column<SKU>[] = useMemo(() => [
    {
      key: 'skuCode',
      label: 'SKU Code',
      sortable: true,
      render: (value) => (
        <div className="font-medium text-foreground">{value as string}</div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      render: (value) => <span className="text-sm text-foreground">{value as string}</span>
    },
    {
      key: 'asin',
      label: 'ASIN',
      sortable: true,
      render: (value) => <span className="text-sm text-muted-foreground">{(value as string) || '-'}</span>
    },
    {
      key: 'unitsPerCarton',
      label: 'Units/Carton',
      sortable: true,
      className: 'text-right',
      render: (value) => <span className="font-medium">{value as number}</span>
    },
    {
      key: 'unitDimensionsCm',
      label: 'Unit Dimensions (L×W×H)',
      render: (value) => <span className="text-sm text-foreground">{(value as string) || '-'}</span>
    },
    {
      key: 'cartonDimensionsCm',
      label: 'Carton Dimensions (L×W×H)',
      render: (value) => <span className="text-sm text-foreground">{(value as string) || '-'}</span>
    },
    {
      key: 'cartonWeightKg',
      label: 'Carton Weight',
      className: 'text-right',
      render: (value) => <span className="text-sm text-foreground">{value ? `${value} kg` : '-'}</span>
    },
    {
      key: 'packSize',
      label: 'Pack Size',
      className: 'text-center',
      render: (value) => <span className="text-sm text-foreground">{value as number}</span>
    },
    {
      key: 'isActive',
      label: 'Status',
      className: 'text-center',
      render: (value) => (
        <span className={(value as boolean) ? 'badge-success' : 'badge-secondary'}>
          {(value as boolean) ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-right w-36',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => handleEditSKU(row.id)}
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title="Edit SKU"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleDeleteClick(row)}
            variant="destructive"
            size="icon"
            className="h-9 w-9"
            title="Delete SKU"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleToggleActive(row)}
            variant="ghost"
            size="sm"
            className="text-xs"
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      )
    }
  ], [handleDeleteClick, handleEditSKU, handleToggleActive])

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-2">
        {/* Page Header with Description */}
        <PageHeader
          title="SKU Management"
          subtitle="Manage product definitions and specifications"
          icon={Package2}
          iconColor="text-indigo-600"
          bgColor="bg-indigo-50"
          borderColor="border-indigo-200"
          textColor="text-indigo-800"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <label htmlFor="products-search" className="sr-only">
                  Search products by SKU code, description, or ASIN
                </label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="products-search"
                  name="search"
                  type="search"
                  placeholder="Search SKUs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Search products by SKU code, description, or ASIN"
                />
              </div>
              <ImportButton
                entityName="skus"
                onImportComplete={fetchSkus}
              />
              <Button asChild className="gap-2">
                <Link href="/config/products/new">
                  <Plus className="h-4 w-4" />
                  Add SKU
                </Link>
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-end">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show inactive
          </label>
        </div>

        <StatsCardGrid cols={4} gap="gap-4" className="pt-2">
          <StatsCard
            title="Total SKUs"
            value={skuSummary.total}
            subtitle="Across current filters"
            icon={Package2}
            size="sm"
          />
          <StatsCard
            title="Active"
            value={skuSummary.active}
            subtitle="Ready for fulfillment"
            icon={CheckCircle2}
            variant="success"
            size="sm"
          />
          <StatsCard
            title="Inactive"
            value={skuSummary.inactive}
            subtitle="Hidden from workflows"
            icon={Archive}
            variant="warning"
            size="sm"
          />
          <StatsCard
            title="With ASIN"
            value={skuSummary.withAsin}
            subtitle="Amazon-linked"
            icon={Link2}
            variant="info"
            size="sm"
          />
        </StatsCardGrid>

        {/* SKU Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h3 className="text-lg font-semibold">Products (SKUs)</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredSkus.length} products
            </p>
          </div>
          {loading ? (
            <div className="py-12">
              <DataTable
                data={filteredSkus}
                columns={columns}
                loading
                rowKey="id"
              />
            </div>
          ) : filteredSkus.length === 0 ? (
            <div className="px-6 py-12">
              <EmptyState
                icon={Package2}
                title={searchTerm || showInactive ? 'No SKUs match your criteria' : 'No SKUs defined yet'}
                description={searchTerm || showInactive
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Start by adding your first SKU to begin tracking inventory.'}
                action={!searchTerm && !showInactive ? {
                  label: 'Add First SKU',
                  onClick: () => router.push('/config/products/new')
                } : undefined}
              />
            </div>
          ) : (
            <DataTable
              data={filteredSkus}
              columns={columns}
              rowKey="id"
            />
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {skuToDelete && (
          <ConfirmDialog
            isOpen={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false)
              setSkuToDelete(null)
            }}
            onConfirm={handleDeleteConfirm}
            title={`Delete SKU ${skuToDelete.skuCode}?`}
            message={
              Object.values(skuToDelete._count).some(count => count > 0)
                ? "This SKU has related data and will be deactivated instead of deleted. Continue?"
                : "Are you sure you want to delete this SKU? This action cannot be undone."
            }
            confirmText="Delete"
            type="danger"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
