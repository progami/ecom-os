'use client'

import Link from 'next/link'
import {
 forwardRef,
 useCallback,
 useEffect,
 useImperativeHandle,
 useMemo,
 useState,
} from 'react'
import { toast } from 'react-hot-toast'
import {
 Edit,
 Loader2,
 Package2,
 Search,
 Trash2,
} from '@/lib/lucide-icons'
import { EmptyState } from '@/components/ui/empty-state'
import { ImportButton } from '@/components/ui/import-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'

export interface ProductsPanelHandle {
 refresh: () => Promise<void>
}

interface Sku {
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

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
 { label: 'All', value: 'ALL' },
 { label: 'Active', value: 'ACTIVE' },
 { label: 'Inactive', value: 'INACTIVE' },
]

const ProductsPanel = forwardRef<ProductsPanelHandle>((_, ref) => {
 const [skus, setSkus] = useState<Sku[]>([])
 const [loading, setLoading] = useState(false)
 const [searchTerm, setSearchTerm] = useState('')
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
 const [dialogOpen, setDialogOpen] = useState(false)
 const [selectedSku, setSelectedSku] = useState<Sku | null>(null)

 const buildQuery = useCallback(() => {
 const params = new URLSearchParams()
 if (searchTerm.trim()) params.append('search', searchTerm.trim())
 if (statusFilter === 'INACTIVE') params.append('includeInactive', 'true')
 if (statusFilter === 'ALL') params.append('includeInactive', 'true')
 return params.toString()
 }, [searchTerm, statusFilter])

 const fetchSkus = useCallback(async () => {
 try {
 setLoading(true)
 const response = await fetch(`/api/skus?${buildQuery()}`)
 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 throw new Error(payload?.error ?? 'Failed to load products')
 }

 const data = await response.json()
 setSkus(Array.isArray(data) ? data : [])
 } catch (error) {
 toast.error(error instanceof Error ? error.message : 'Failed to load products')
 } finally {
 setLoading(false)
 }
 }, [buildQuery])

 useImperativeHandle(ref, () => ({ refresh: fetchSkus }), [fetchSkus])

 useEffect(() => {
 fetchSkus()
 }, [fetchSkus])

 const filteredSkus = useMemo(() => {
 const term = searchTerm.trim().toLowerCase()
 return skus.filter(sku => {
 if (statusFilter === 'ACTIVE' && !sku.isActive) return false
 if (statusFilter === 'INACTIVE' && sku.isActive) return false
 if (!term) return true
 return (
 sku.skuCode.toLowerCase().includes(term) ||
 sku.description.toLowerCase().includes(term) ||
 (sku.asin ?? '').toLowerCase().includes(term)
 )
 })
 }, [skus, statusFilter, searchTerm])

 const requiresDeactivation = useCallback((sku: Sku) => {
 return Object.values(sku._count).some(count => count > 0)
 }, [])

 const handleDelete = useCallback(
 async (sku: Sku) => {
 const needsDeactivate = requiresDeactivation(sku)

 try {
 if (needsDeactivate) {
 const response = await fetch(`/api/skus?id=${sku.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: false }),
 })

 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 throw new Error(payload?.error ?? 'Failed to deactivate product')
 }

 toast.success(`${sku.skuCode} deactivated`)
 } else {
 const response = await fetch(`/api/skus?id=${sku.id}`, {
 method: 'DELETE',
 })

 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 throw new Error(payload?.error ?? 'Failed to delete product')
 }

 toast.success(`${sku.skuCode} deleted`)
 }

 fetchSkus()
 } catch (error) {
 toast.error(error instanceof Error ? error.message : 'Failed to update product')
 }
 },
 [fetchSkus, requiresDeactivation]
 )

 const confirmDelete = useCallback(
 (sku: Sku) => {
 setSelectedSku(sku)
 setDialogOpen(true)
 },
 []
 )

 const handleToggleActive = useCallback(
 async (sku: Sku) => {
 try {
 const response = await fetch(`/api/skus?id=${sku.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: !sku.isActive }),
 })

 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 throw new Error(payload?.error ?? 'Failed to update status')
 }

 toast.success(`${sku.skuCode} ${sku.isActive ? 'deactivated' : 'reactivated'}`)
 fetchSkus()
 } catch (error) {
 toast.error(error instanceof Error ? error.message : 'Failed to update status')
 }
 },
 [fetchSkus]
 )

 return (
 <div className="flex min-h-0 flex-col gap-6">
 <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
 <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
 <div className="flex flex-col gap-1">
 <h3 className="text-sm font-semibold text-muted-foreground">Products</h3>
 <p className="text-xs text-muted-foreground">
 Showing {filteredSkus.length.toLocaleString()} SKU{filteredSkus.length === 1 ? '' : 's'}
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <div className="relative w-56">
 <label htmlFor="products-search" className="sr-only">
 Search products
 </label>
 <Search
 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
 aria-hidden="true"
 />
 <input
 id="products-search"
 value={searchTerm}
 onChange={event => setSearchTerm(event.target.value)}
 placeholder="Search by SKU, description, ASIN"
 className="w-full rounded-md border border-border/60 bg-white py-2 pl-9 pr-3 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
 />
 </div>
 <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-white p-1">
 {STATUS_FILTERS.map(filter => (
 <Button
 key={filter.value}
 size="sm"
 variant={statusFilter === filter.value ? 'default' : 'ghost'}
 className="px-3 py-1 text-xs"
 onClick={() => setStatusFilter(filter.value)}
 >
 {filter.label}
 </Button>
 ))}
 </div>
 <ImportButton entityName="skus" onImportComplete={fetchSkus} />
 <Button variant="outline" asChild>
 <Link href="/config/products/new">Quick add</Link>
 </Button>
 </div>
 </div>

 {loading ? (
 <div className="flex h-40 items-center justify-center text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 </div>
 ) : filteredSkus.length === 0 ? (
 <div className="p-10">
 <EmptyState
 icon={Package2}
 title={searchTerm || statusFilter !== 'ALL' ? 'No products found' : 'No products yet'}
 description={
 searchTerm || statusFilter !== 'ALL'
 ? 'Adjust filters or clear your search to view more products.'
 : 'Create your first SKU to begin tracking inventory movements.'
 }
 action={
 !searchTerm && statusFilter === 'ALL'
 ? {
 label: 'Create SKU',
 onClick: () => window.location.assign('/config/products/new'),
 }
 : undefined
 }
 />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="min-w-full table-auto text-sm">
 <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
 <tr>
 <th className="px-3 py-2 text-left font-semibold">SKU</th>
 <th className="px-3 py-2 text-left font-semibold">Description</th>
 <th className="px-3 py-2 text-left font-semibold">ASIN</th>
 <th className="px-3 py-2 text-right font-semibold">Units / Carton</th>
 <th className="px-3 py-2 text-left font-semibold">Unit Dimensions (cm)</th>
 <th className="px-3 py-2 text-left font-semibold">Carton Dimensions (cm)</th>
 <th className="px-3 py-2 text-right font-semibold">Carton Weight</th>
 <th className="px-3 py-2 text-left font-semibold">Status</th>
 <th className="px-3 py-2 text-right font-semibold">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredSkus.map(sku => (
 <tr key={sku.id} className="odd:bg-muted/20">
 <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{sku.skuCode}</td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{sku.description}</td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{sku.asin ?? '—'}</td>
 <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
 {sku.unitsPerCarton.toLocaleString()}
 </td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
 {sku.unitDimensionsCm ?? '—'}
 </td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
 {sku.cartonDimensionsCm ?? '—'}
 </td>
 <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
 {sku.cartonWeightKg ? `${sku.cartonWeightKg} kg` : '—'}
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 <Badge
 className={
 sku.isActive
 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
 : 'bg-slate-100 text-slate-600 border border-slate-200'
 }
 >
 {sku.isActive ? 'Active' : 'Inactive'}
 </Badge>
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 <div className="flex items-center justify-end gap-2">
 <Button
 size="icon"
 variant="outline"
 className="h-9 w-9"
 asChild
 >
 <Link href={`/config/products/${sku.id}/edit`} aria-label={`Edit ${sku.skuCode}`}>
 <Edit className="h-4 w-4" />
 </Link>
 </Button>
 <Button
 size="icon"
 variant="destructive"
 className="h-9 w-9"
 onClick={() => confirmDelete(sku)}
 aria-label={`Delete ${sku.skuCode}`}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 <Button
 size="sm"
 variant="ghost"
 className="text-xs"
 onClick={() => handleToggleActive(sku)}
 >
 {sku.isActive ? 'Deactivate' : 'Activate'}
 </Button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {selectedSku && (
 <ConfirmDialog
 isOpen={dialogOpen}
 onClose={() => {
 setDialogOpen(false)
 setSelectedSku(null)
 }}
 onConfirm={() => {
 if (selectedSku) {
 handleDelete(selectedSku)
 }
 setDialogOpen(false)
 setSelectedSku(null)
 }}
 type={requiresDeactivation(selectedSku) ? 'warning' : 'danger'}
 confirmText={requiresDeactivation(selectedSku) ? 'Deactivate' : 'Delete'}
 title={`${requiresDeactivation(selectedSku) ? 'Deactivate' : 'Delete'} ${selectedSku.skuCode}?`}
 message={
 requiresDeactivation(selectedSku)
 ? 'This SKU is referenced by existing transactions. It will be marked inactive rather than deleted.'
 : 'This action cannot be undone. Are you sure you want to delete this SKU?'
 }
 />
 )}
 </div>
 )
})

ProductsPanel.displayName = 'ProductsPanel'

export default ProductsPanel
