'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, ArrowLeft, Loader2 } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'

interface WarehouseInvoiceLineSummary {
  id: string
  chargeCode: string
  description: string | null
  quantity: number
  unitRate: number
  total: number
  purchaseOrderId: string | null
  movementNoteLineId: string | null
}

interface WarehouseInvoiceSummary {
  id: string
  invoiceNumber: string
  status: 'DRAFT' | 'IMPORTED' | 'MATCHED' | 'DISPUTED' | 'CLOSED'
  issuedAt: string | null
  dueAt: string | null
  warehouseCode: string
  warehouseName: string
  currency: string
  subtotal: number
  total: number
  notes?: string | null
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

export default function WarehouseInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<WarehouseInvoiceSummary | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/warehouse-invoices/${params.id}`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }

    const loadInvoice = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/warehouse-invoices/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to load warehouse invoice')
        }
        const data: WarehouseInvoiceSummary = await response.json()
        const normalized: WarehouseInvoiceSummary = {
          ...data,
          subtotal: Number(data.subtotal ?? 0),
          total: Number(data.total ?? 0),
          lines: Array.isArray(data.lines)
            ? data.lines.map(line => ({
                ...line,
                quantity: Number(line.quantity ?? 0),
                unitRate: Number(line.unitRate ?? 0),
                total: Number(line.total ?? 0),
              }))
            : [],
        }
        setInvoice(normalized)
      } catch (_error) {
        toast.error('Failed to load warehouse invoice')
        router.push('/operations/warehouse-invoices')
      } finally {
        setLoading(false)
      }
    }

    loadInvoice()
  }, [params.id, router, session, status])

  const headerActions = useMemo(() => (
    <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  ), [router])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Loading warehouse invoice…</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-2">
        <PageHeader
          title={`Warehouse Invoice ${invoice.invoiceNumber}`}
          subtitle={`${invoice.warehouseName} (${invoice.warehouseCode})`}
          icon={FileText}
          iconColor="text-cyan-600"
          bgColor="bg-cyan-50"
          borderColor="border-cyan-200"
          textColor="text-cyan-800"
          actions={headerActions}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{invoice.status}</Badge>
          <div className="text-sm text-muted-foreground">Issued: {formatDate(invoice.issuedAt)}</div>
          <div className="text-sm text-muted-foreground">Due: {formatDate(invoice.dueAt)}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-soft">
            <h3 className="text-sm font-semibold text-muted-foreground">Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium text-foreground">{formatCurrency(invoice.subtotal, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium text-foreground">{formatCurrency(invoice.total, invoice.currency)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border bg-white shadow-soft">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Invoice Lines</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Charge</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                  <th className="px-3 py-2 text-right font-semibold">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map(line => (
                  <tr key={line.id} className="odd:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">{line.chargeCode}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{line.description || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{line.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.unitRate, invoice.currency)}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(line.total, invoice.currency)}</td>
                    <td className="px-3 py-2 text-xs text-primary whitespace-nowrap space-x-2">
                      {line.purchaseOrderId && (
                        <Link href={`/operations/purchase-orders/${line.purchaseOrderId}`} prefetch={false} className="hover:underline">
                          PO
                        </Link>
                      )}
                      {line.movementNoteLineId && (
                        <Link href={`/operations/movement-notes/${line.movementNoteLineId}`} prefetch={false} className="hover:underline">
                          Movement Note Line
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
