'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { FileText } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'

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

interface WarehouseInvoicesPageProps {
  title: string
  description: string
  postLoginRedirectPath: string
  detailBasePath: string
  filterStatuses?: string[]
  emptyStateMessage?: string
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

export function WarehouseInvoicesPage({
  title,
  description,
  postLoginRedirectPath,
  detailBasePath,
  filterStatuses,
  emptyStateMessage = 'No warehouse invoices recorded yet.'
}: WarehouseInvoicesPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<WarehouseInvoiceSummary[]>([])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      redirectToPortal(
        '/login',
        `${window.location.origin}${postLoginRedirectPath}`
      )
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
        const data = await response.json()
        const normalized: WarehouseInvoiceSummary[] = Array.isArray(data?.data)
          ? data.data.map((invoice: WarehouseInvoiceSummary) => ({
              ...invoice,
              subtotal: Number(invoice.subtotal ?? 0),
              total: Number(invoice.total ?? 0),
              lines: Array.isArray(invoice.lines)
                ? invoice.lines.map(line => ({
                    ...line,
                    total: Number(line.total ?? 0)
                  }))
                : []
            }))
            .filter(invoice => (filterStatuses ? filterStatuses.includes(invoice.status) : true))
          : []

        setInvoices(normalized)
      } catch (_error) {
        toast.error('Failed to load warehouse invoices')
      } finally {
        setLoading(false)
      }
    }

    loadInvoices()
  }, [filterStatuses, postLoginRedirectPath, router, session, status])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title={title}
          description={description}
          icon={FileText}
        />
        <PageContent>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Issued</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {emptyStateMessage}
                    </td>
                  </tr>
                ) : (
                  invoices.map(invoice => (
                    <tr key={invoice.id} className="odd:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`${detailBasePath}/${invoice.id}`}
                          className="text-primary hover:underline"
                          prefetch={false}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline">{invoice.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {formatDate(invoice.issuedAt)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-3 py-2 text-xs text-primary whitespace-nowrap">
                        <Link
                          href={`${detailBasePath}/${invoice.id}`}
                          prefetch={false}
                          className="hover:underline"
                        >
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
