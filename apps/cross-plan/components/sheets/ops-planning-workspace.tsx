'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { OpsPlanningGrid, OpsTimelineRow } from '@/components/sheets/ops-planning-grid'
import { PurchasePaymentsGrid, PurchasePaymentRow } from '@/components/sheets/purchase-payments-grid'

interface OpsPlanningWorkspaceProps {
  timeline: OpsTimelineRow[]
  payments: PurchasePaymentRow[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function formatDisplayDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date).replace(',', '')
}

export function OpsPlanningWorkspace({ timeline, payments }: OpsPlanningWorkspaceProps) {
  const [paymentRows, setPaymentRows] = useState(() =>
    payments.map((payment) => ({
      ...payment,
      dueDate: formatDisplayDate(payment.dueDate),
    }))
  )
  const [activeOrderId, setActiveOrderId] = useState<string | null>(timeline[0]?.id ?? null)
  const [isPending, startTransition] = useTransition()

  const visiblePayments = useMemo(() => {
    if (!activeOrderId) return paymentRows
    return paymentRows.filter((payment) => payment.purchaseOrderId === activeOrderId)
  }, [activeOrderId, paymentRows])

  const handleAddPayment = () => {
    const orderId = activeOrderId
    if (!orderId) {
      toast.error('Select a purchase order first')
      return
    }
    const matchingPayments = paymentRows.filter((row) => row.purchaseOrderId === orderId)
    const nextIndex = matchingPayments.length ? Math.max(...matchingPayments.map((row) => row.paymentIndex)) + 1 : 1

    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/cross-plan/purchase-order-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseOrderId: orderId, paymentIndex: nextIndex }),
        })
        if (!response.ok) throw new Error('Failed to add payment')
        const created = (await response.json()) as PurchasePaymentRow
        setPaymentRows((previous) => [
          ...previous,
          {
            ...created,
            dueDate: formatDisplayDate(created.dueDate),
          },
        ])
        toast.success('Payment added')
      } catch (error) {
        console.error(error)
        toast.error('Unable to add payment')
      }
    })
  }

  const handleRowsChange = (rows: PurchasePaymentRow[]) => {
    setPaymentRows((previous) => {
      const overrides = new Map(rows.map((row) => [row.id, { ...row, dueDate: formatDisplayDate(row.dueDate) }]))
      return previous.map((row) => (overrides.has(row.id) ? overrides.get(row.id)! : row))
    })
  }

  return (
    <div className="space-y-6">
      <OpsPlanningGrid
        purchaseOrders={timeline}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
      />
      <PurchasePaymentsGrid
        payments={visiblePayments}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
        onAddPayment={handleAddPayment}
        onRowsChange={handleRowsChange}
        isLoading={isPending}
      />
    </div>
  )
}
