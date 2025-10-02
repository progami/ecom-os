'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, FileText, Plus, Search, Eye, Check, X, Loader2, Filter } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoiceNumber: string
  warehouse: {
    id: string
    code: string
    name: string
  }
  billingPeriodStart: string
  billingPeriodEnd: string
  invoiceDate: string
  dueDate: string | null
  totalAmount: number
  status: 'pending' | 'reconciled' | 'disputed' | 'paid'
  lineItems: Array<{
    id: string
    costCategory: string
    costName: string
    quantity: number
    unitRate?: number
    amount: number
  }>
  reconciliations: Array<{
    id: string
    costCategory: string
    costName: string
    expectedAmount: number
    invoicedAmount: number
    difference: number
    status: 'match' | 'overbilled' | 'underbilled'
    resolutionNotes?: string
    resolvedBy?: {
      fullName: string
      email: string
    }
    resolvedAt?: string
  }>
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export default function FinanceInvoicesPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [_uploading, setUploading] = useState(false)
  const [warehouses, setWarehouses] = useState<Array<{
    id: string
    name: string
    code: string
  }>>([])

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedMonth) params.append('month', selectedMonth)
      if (selectedYear) params.append('year', selectedYear)

      const response = await fetch(`/api/invoices?${params}`)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      
      const data = await response.json()
      setInvoices(data.invoices)
      setPagination(data.pagination)
    } catch (_error) {
    } finally {
      setLoading(false)
    }
  }

  // Fetch warehouses
  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data = await response.json()
      setWarehouses(data)
    } catch (_error) {
    }
  }

  useEffect(() => {
    fetchInvoices()
    fetchWarehouses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, searchTerm, selectedWarehouse, selectedStatus, selectedMonth, selectedYear])

  // Handle file upload
  const _handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresManualEntry) {
          // Handle PDF manual entry
          router.push('/finance/invoices/new?manual=true&filename=' + encodeURIComponent(data.fileName))
        } else {
          throw new Error(data.error || 'Upload failed')
        }
      } else {
        // Success - refresh invoices
        await fetchInvoices()
        alert('Invoice uploaded successfully!')
      }
    } catch (_error) {
      alert('Failed to upload invoice')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle invoice actions
  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/finance/invoices/${invoiceId}`)
  }

  const handleProcessInvoice = (invoiceId: string) => {
    router.push(`/finance/reconciliation?invoiceId=${invoiceId}`)
  }

  const handlePayInvoice = async (invoiceId: string) => {
    const paymentMethod = prompt('Enter payment method (e.g., Bank Transfer, Check, Wire):')
    if (!paymentMethod) return

    const paymentReference = prompt('Enter payment reference number:')
    if (!paymentReference) return

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentMethod,
          paymentReference,
          paymentDate: new Date().toISOString(),
          notes: 'Accepted via invoice list'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept invoice')
      }
      
      await fetchInvoices()
      alert('Invoice accepted and marked for payment!')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invoice'
      alert(errorMessage)
    }
  }

  const handleDisputeInvoice = async (invoiceId: string) => {
    const reason = prompt('Enter dispute reason:')
    if (!reason) return

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          generalDisputeReason: reason,
          notes: 'Disputed via invoice list',
          contactWarehouse: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to dispute invoice')
      }
      
      const result = await response.json()
      await fetchInvoices()
      alert(`Invoice disputed successfully! ${result.disputedItems} items disputed totaling ${formatCurrency(result.totalDisputedAmount)}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to dispute invoice'
      alert(errorMessage)
    }
  }

  const clearFilters = () => {
    setSelectedWarehouse('')
    setSelectedStatus('')
    setSelectedMonth('')
    setSelectedYear('')
  }

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ type: 'invoices' })
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedMonth) params.append('month', selectedMonth)
      if (selectedYear) params.append('year', selectedYear)
      
      const response = await fetch(`/api/export?${params}`)
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (_error) {
      alert('Failed to export data')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge-warning'
      case 'reconciled':
        return 'badge-info'
      case 'disputed':
        return 'badge-error'
      case 'paid':
        return 'badge-success'
      default:
        return 'badge'
    }
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Invoices"
          description="Finance"
          icon={FileText}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <label htmlFor="invoices-search" className="sr-only">
                  Search invoices by invoice number, warehouse, or amount
                </label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="invoices-search"
                  name="search"
                  type="search"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-white py-2 pl-9 pr-3 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Search invoices by invoice number, warehouse, or amount"
                />
              </div>
              <Button
                onClick={handleExport}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button asChild className="gap-2">
                <Link href="/finance/invoices/new">
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Link>
              </Button>
            </div>
          }
        />
        <PageContent>
        <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select 
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(warehouse => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="reconciled">Reconciled</option>
              <option value="disputed">Disputed</option>
              <option value="paid">Paid</option>
            </select>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }).map((_, index) => (
                <option key={index} value={index + 1}>
                  {format(new Date(2023, index, 1), 'MMMM')}
                </option>
              ))}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Years</option>
              {Array.from({ length: 5 }).map((_, index) => (
                <option key={index} value={2023 - index}>{2023 - index}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="ghost"
              className="gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide advanced filters' : 'Show advanced filters'}
            </Button>
            {(selectedWarehouse || selectedStatus || selectedMonth || selectedYear) && (
              <Button
                onClick={clearFilters}
                variant="link"
                className="text-sm"
              >
                Clear all filters
              </Button>
            )}
          </div>
        </div>

        {/* Invoice Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-soft dark:border-[#0b3a52]">
          <div className="bg-slate-50 px-6 py-3 border-b">
            <h3 className="text-lg font-semibold">Invoices</h3>
            <p className="text-sm text-slate-600 mt-1">
              Showing {invoices.length} of {pagination.totalCount} invoices
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Billing Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                    <p className="mt-2 text-slate-500">Loading invoices...</p>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-slate-400" />
                    <p className="mt-2 text-slate-500">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {invoice.warehouse.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(invoice.status)}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        onClick={() => handleViewInvoice(invoice.id)}
                        variant="ghost"
                        size="sm"
                        className="px-0 mr-3 gap-1 text-primary hover:text-primary"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      {invoice.status === 'pending' && (
                        <>
                          <Button
                            onClick={() => handleProcessInvoice(invoice.id)}
                            variant="ghost"
                            size="sm"
                            className="px-0 mr-3 text-primary hover:text-primary"
                          >
                            Process
                          </Button>
                          <Button
                            onClick={() => handleDisputeInvoice(invoice.id)}
                            variant="ghost"
                            size="sm"
                            className="px-0 gap-1 text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                            Dispute
                          </Button>
                        </>
                      )}
                      {invoice.status === 'reconciled' && (
                        <>
                          <Button
                            onClick={() => handlePayInvoice(invoice.id)}
                            variant="ghost"
                            size="sm"
                            className="px-0 mr-3 gap-1 text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleDisputeInvoice(invoice.id)}
                            variant="ghost"
                            size="sm"
                            className="px-0 gap-1 text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                            Dispute
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border rounded-lg">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.totalCount}</span>{' '}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-soft -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
        </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
