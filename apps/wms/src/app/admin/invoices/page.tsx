'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { Plus, Search, Filter, Download, FileText, CheckCircle, AlertCircle, Clock, X } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type ColumnFilterKey = 'search' | 'status'

interface ColumnFiltersState {
  search: string
  status: string[]
}

const createColumnFilterDefaults = (): ColumnFiltersState => ({
  search: '',
  status: [],
})

export default function AdminInvoicesPage() {
  const { data: session, status } = useSession()
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

  const toggleStatusFilter = useCallback((status: string) => {
    setColumnFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
  }, [])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
        </div>
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'admin') {
    if (typeof window !== 'undefined') {
      const central = (process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL as string) || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', window.location.origin + '/admin/invoices')
      window.location.replace(url.toString())
    }
    return null
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Admin Invoices"
          description="Administration"
          icon={FileText}
          actions={
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-soft text-sm font-medium text-foreground bg-white hover:bg-secondary">
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <Link
                href="/admin/invoices/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-soft text-sm font-medium text-white bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Link>
            </div>
          }
        />
        <PageContent>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <InvoiceStatusCard
            title="Pending Review"
            count={3}
            icon={Clock}
            color="text-yellow-600 bg-yellow-100"
          />
          <InvoiceStatusCard
            title="Reconciled"
            count={12}
            icon={CheckCircle}
            color="text-green-600 bg-green-100"
          />
          <InvoiceStatusCard
            title="Disputed"
            count={2}
            icon={AlertCircle}
            color="text-red-600 bg-red-100"
          />
          <InvoiceStatusCard
            title="Total Amount"
            count="£45,678"
            icon={FileText}
            color="text-cyan-600 bg-cyan-100"
          />
        </div>

        {/* Invoice Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    Invoice #
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
                          <span className="text-sm font-medium text-foreground">Search filter</span>
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
                            placeholder="Search invoice #, warehouse..."
                            value={columnFilters.search}
                            onChange={e => setColumnFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full rounded-md border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Billing Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                          {['Pending', 'Reconciled', 'Disputed', 'Paid'].map(status => (
                            <label key={status} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={columnFilters.status.includes(status)}
                                onChange={() => toggleStatusFilter(status)}
                                className="rounded border-border"
                              />
                              <span className="text-foreground">{status}</span>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date Received
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  INV-2025-001
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  FMC
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Dec 16 - Jan 15
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right">
                  £12,456.78
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Jan 18, 2025
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href="/admin/invoices/INV-2025-001" className="text-primary hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
              <tr className="hover:bg-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  INV-2024-089
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  Vglobal
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Nov 16 - Dec 15
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right">
                  £8,234.50
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Reconciled
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Dec 17, 2024
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href="/admin/invoices/INV-2024-089" className="text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
              <tr className="hover:bg-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  INV-2024-088
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  FMC
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Nov 16 - Dec 15
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground text-right">
                  £10,123.45
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Disputed
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  Dec 16, 2024
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href="/admin/invoices/INV-2024-088" className="text-primary hover:underline">
                    Resolve
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-foreground">
            Showing <span className="font-medium">1</span> to{' '}
            <span className="font-medium">10</span> of{' '}
            <span className="font-medium">89</span> results
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded-md text-sm hover:bg-secondary">
              Previous
            </button>
            <button className="px-3 py-1 border rounded-md text-sm hover:bg-secondary">
              Next
            </button>
          </div>
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

interface InvoiceStatusCardProps {
  title: string
  count: number | string
  icon: React.ElementType
  color: string
}

function InvoiceStatusCard({ title, count, icon: Icon, color }: InvoiceStatusCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{count}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
