'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText, Filter, Search, X } from '@/lib/lucide-icons'
import { cn } from '@/lib/utils'
import { buildCentralLoginUrl } from '@/lib/utils/url'

interface WarehouseInvoiceLineSummary {
  id: string
  total: number
}

interface WarehouseInvoiceSummary {
  id: string
  invoiceNumber: string
  status: 'DRAFT' | 'IMPORTED' | 'MATCHED' | 'DISPUTED' | 'CLOSED'
  issuedAt: string | null
  currency: string
  subtotal: number
  total: number
  lines: WarehouseInvoiceLineSummary[]
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString()
}

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString(undefined, { style: 'currency', currency })
}

type ColumnFilterKey = 'search' | 'status'

interface ColumnFiltersState {
  search: string
  status: string[]
}

const createColumnFilterDefaults = (): ColumnFiltersState => ({
  search: '',
  status: [],
})

export default function WarehouseInvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<WarehouseInvoiceSummary[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(createColumnFilterDefaults())

  const isFilterActive = useCallback(
    (keys: ColumnFilterKey[]) =>
      keys.some(key => {
        const value = columnFilters[key]
        if (Array.isArray(value)) {
          return value.length > 0
        }
        return typeof value === 'string' && value.trim().length > 0
      }),
    [columnFilters]
  )

  const clearColumnFilter = useCallback((keys: ColumnFilterKey[]) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      for (const key of keys) {
        if (key === 'search') {
          next.search = ''
        } else if (key === 'status') {
          next.status = []
        }
      }
      return next
    })
  }, [])

  const toggleStatusFilter = useCallback((statusValue: string) => {
    setColumnFilters(prev => ({
      ...prev,
      status: prev.status.includes(statusValue)
        ? prev.status.filter(s => s !== statusValue)
        : [...prev.status, statusValue]
    }))
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      window.location.href = buildCentralLoginUrl('/finance/warehouse-invoices')
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }

    const loadInvoices = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/warehouse-invoices')
        if (!response.ok) {
          throw new Error('Failed to load warehouse invoices')
        }
        const data = await response.json() as {
          data?: Array<WarehouseInvoiceSummary & { lines?: WarehouseInvoiceLineSummary[] }>
        }
        const normalized = Array.isArray(data?.data)
          ? data.data.map(invoice => ({
              ...invoice,
              subtotal: Number(invoice.subtotal ?? invoice.total ?? 0),
              total: Number(invoice.total ?? 0),
              lines: Array.isArray(invoice.lines)
                ? invoice.lines.map(line => ({
                    ...line,
                    total: Number(line.total ?? 0),
                  }))
                : [],
            }))
          : []

        setInvoices(normalized)
      } catch (_error) {
        toast.error('Failed to load warehouse invoices')
      } finally {
        setLoading(false)
      }
    }

    loadInvoices()
  }, [router, session, status])

  // Filter invoices based on column filters
  const filteredInvoices = invoices.filter(invoice => {
    // Search filter
    if (columnFilters.search) {
      const searchLower = columnFilters.search.toLowerCase()
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }

    // Status filter
    if (columnFilters.status.length > 0) {
      if (!columnFilters.status.includes(invoice.status)) return false
    }

    return true
  })

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Warehouse Invoices"
          description="Operations"
          icon={FileText}
        />
        <PageContent>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-2">
                    Invoice
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter invoice numbers"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['search'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Search invoice</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['search'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search invoice number..."
                            value={columnFilters.search}
                            onChange={e => setColumnFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-2">
                    Status
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter status"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['status'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Status filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['status'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-2">
                          {['DRAFT', 'IMPORTED', 'MATCHED', 'DISPUTED', 'CLOSED'].map(statusValue => (
                            <label key={statusValue} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={columnFilters.status.includes(statusValue)}
                                onChange={() => toggleStatusFilter(statusValue)}
                                className="rounded border-border"
                              />
                              <span className="text-foreground">{statusValue}</span>
                            </label>
                          ))}
                        </div>
                        {columnFilters.status.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {columnFilters.status.map(s => (
                              <span
                                key={s}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {s}
                                <button
                                  type="button"
                                  onClick={() => toggleStatusFilter(s)}
                                  className="hover:text-primary/70"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold">Issued</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {invoices.length === 0 ? 'No warehouse invoices recorded yet.' : 'No invoices match the current filters.'}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(invoice => (
                  <tr key={invoice.id} className="odd:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/finance/warehouse-invoices/${invoice.id}`} className="text-primary hover:underline" prefetch={false}>
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="outline">{invoice.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(invoice.issuedAt)}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(invoice.total, invoice.currency)}</td>
                    <td className="px-3 py-2 text-xs text-primary whitespace-nowrap">
                      <Link href={`/finance/warehouse-invoices/${invoice.id}`} prefetch={false} className="hover:underline">
                        View invoice
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
