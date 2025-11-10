'use client'
import { useRouter } from 'next/navigation'
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
  Loader2,
  Package2,
  Search,
} from '@/lib/lucide-icons'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface InventoryPanelHandle {
  refresh: () => Promise<void>
}

interface SkuInventorySummary {
  skuCode: string
  description: string
  asin: string | null
  unitsPerCarton: number
  unitDimensionsCm: string | null
  cartonDimensionsCm: string | null
  isActive: boolean
  totalOnHand: number
  totalCartons: number
  totalPallets: number
  batchCount: number
  lastReceiveDate: string | null
  avgUnitCost: number | null
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
]

const InventoryPanel = forwardRef<InventoryPanelHandle>((_, ref) => {
  const router = useRouter()
  const [skus, setSkus] = useState<SkuInventorySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE')

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
      const response = await fetch(`/api/inventory/skus?${buildQuery()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load inventory')
      }

      const data = await response.json()
      setSkus(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load inventory')
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

  const formatNumber = (value: number) => {
    return value.toLocaleString()
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Inventory</h3>
            <p className="text-xs text-muted-foreground">
              Showing {filteredSkus.length.toLocaleString()} SKU{filteredSkus.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <label htmlFor="inventory-search" className="sr-only">
                Search inventory
              </label>
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="inventory-search"
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
              title={searchTerm || statusFilter !== 'ALL' ? 'No inventory found' : 'No inventory yet'}
              description={
                searchTerm || statusFilter !== 'ALL'
                  ? 'Adjust filters or clear your search to view more inventory.'
                  : 'Receive inventory through purchase orders to see it here.'
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
                  <th className="px-3 py-2 text-right font-semibold">Batches</th>
                  <th className="px-3 py-2 text-right font-semibold">On Hand (Units)</th>
                  <th className="px-3 py-2 text-right font-semibold">Cartons</th>
                  <th className="px-3 py-2 text-right font-semibold">Pallets</th>
                  <th className="px-3 py-2 text-left font-semibold">Last Receive</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map(sku => (
                  <tr
                    key={sku.skuCode}
                    className="cursor-pointer odd:bg-muted/20 hover:bg-primary/5 transition-colors"
                    onClick={() => router.push(`/config/products/${sku.skuCode}`)}
                  >
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {sku.skuCode}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {sku.description}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {sku.asin ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      {formatNumber(sku.batchCount)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      {formatNumber(sku.totalOnHand)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatNumber(sku.totalCartons)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {formatNumber(sku.totalPallets)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(sku.lastReceiveDate)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
})

InventoryPanel.displayName = 'InventoryPanel'

export default InventoryPanel
