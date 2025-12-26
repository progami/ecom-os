'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, FileText } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

type AdjustmentType = 'ADJUST_IN' | 'ADJUST_OUT'

type WarehouseOption = {
  id: string
  code: string
  name: string
  isActive: boolean
  kind?: string
}

type SkuBatchOption = {
  id: string
  batchCode: string
  isActive: boolean
}

type SkuOption = {
  id: string
  skuCode: string
  description: string
  batches: SkuBatchOption[]
}

type CreateTransactionResponse =
  | {
      success: true
      message: string
      transactionIds: string[]
    }
  | { error: string }

function nowDateTimeLocalValue() {
  return new Date().toISOString().slice(0, 16)
}

export default function NewTransactionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const requestedType = searchParams.get('type')
  const defaultType: AdjustmentType = requestedType === 'ADJUST_IN' ? 'ADJUST_IN' : 'ADJUST_OUT'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [skus, setSkus] = useState<SkuOption[]>([])

  const [form, setForm] = useState({
    transactionType: defaultType as AdjustmentType,
    transactionDate: nowDateTimeLocalValue(),
    referenceNumber: '',
    notes: '',
    warehouseId: '',
    skuId: '',
    batchLot: '',
    quantity: '1',
  })

  useEffect(() => {
    setForm(prev => ({ ...prev, transactionType: defaultType }))
  }, [defaultType])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/transactions/new`)
      return
    }
  }, [session, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const load = async () => {
      try {
        setLoading(true)

        const [warehousesRes, skusRes] = await Promise.all([
          fetch('/api/warehouses?includeAmazon=true'),
          fetch('/api/skus'),
        ])

        const warehousesPayload = await warehousesRes.json().catch(() => null)
        const skusPayload = await skusRes.json().catch(() => null)

        if (!warehousesRes.ok) {
          throw new Error(warehousesPayload?.error ?? 'Failed to load warehouses')
        }
        if (!skusRes.ok) {
          throw new Error(skusPayload?.error ?? 'Failed to load SKUs')
        }

        const warehousesData = Array.isArray(warehousesPayload?.data)
          ? (warehousesPayload.data as WarehouseOption[])
          : Array.isArray(warehousesPayload)
            ? (warehousesPayload as WarehouseOption[])
            : []

        const skusData = Array.isArray(skusPayload?.data)
          ? (skusPayload.data as SkuOption[])
          : Array.isArray(skusPayload)
            ? (skusPayload as SkuOption[])
            : []

        setWarehouses(warehousesData.filter(w => w.isActive))
        setSkus(skusData)

        if (session.user.role === 'staff' && session.user.warehouseId) {
          setForm(prev => ({ ...prev, warehouseId: session.user.warehouseId || '' }))
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session?.user.role, session?.user.warehouseId, status])

  const selectedWarehouse = useMemo(
    () => warehouses.find(w => w.id === form.warehouseId),
    [form.warehouseId, warehouses]
  )

  const selectedSku = useMemo(() => skus.find(s => s.id === form.skuId), [form.skuId, skus])

  const batchOptions = useMemo(() => {
    return selectedSku?.batches?.filter(batch => batch.isActive) ?? []
  }, [selectedSku])

  const handleSubmit = async () => {
    if (!session) return

    const qty = Number.parseInt(form.quantity, 10)
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Quantity must be a positive integer (cartons)')
      return
    }

    if (!form.referenceNumber.trim()) {
      toast.error('Reference / reason is required')
      return
    }

    if (!form.transactionDate) {
      toast.error('Transaction date is required')
      return
    }

    if (session.user.role !== 'staff' && !form.warehouseId) {
      toast.error('Select a warehouse')
      return
    }

    if (!form.skuId || !form.batchLot) {
      toast.error('Select a SKU and batch/lot')
      return
    }

    try {
      setSubmitting(true)
      const response = await fetchWithCSRF('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: form.transactionType,
          referenceNumber: form.referenceNumber.trim(),
          transactionDate: form.transactionDate,
          warehouseId: form.warehouseId || undefined,
          skuId: form.skuId,
          batchLot: form.batchLot,
          cartonsIn: form.transactionType === 'ADJUST_IN' ? qty : undefined,
          cartonsOut: form.transactionType === 'ADJUST_OUT' ? qty : undefined,
          notes: form.notes.trim() || undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as CreateTransactionResponse | null
      if (!response.ok) {
        toast.error(payload && 'error' in payload ? payload.error : 'Failed to create adjustment')
        return
      }

      const transactionId = payload && 'transactionIds' in payload ? payload.transactionIds?.[0] : null
      if (!transactionId) {
        toast.error('Adjustment created, but no transaction ID was returned')
        return
      }

      toast.success('Adjustment created — upload evidence to finalize')
      router.push(`/operations/transactions/${transactionId}`)
    } catch (_error) {
      toast.error('Failed to create adjustment')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <PageHeaderSection title="New Adjustment" description="Inventory Ledger" icon={FileText} />
          <PageContent className="px-4 py-6 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </PageContent>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="New Adjustment"
          description="Inventory Ledger"
          icon={FileText}
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link href="/operations/inventory">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          }
        />
        <PageContent className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <div className="rounded-xl border bg-white p-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.transactionType}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        transactionType: e.target.value as AdjustmentType,
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="ADJUST_OUT">Adjust Out (reduce stock)</option>
                    <option value="ADJUST_IN">Adjust In (increase stock)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Transaction Date</label>
                  <Input
                    type="datetime-local"
                    value={form.transactionDate}
                    onChange={e => setForm(prev => ({ ...prev, transactionDate: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Reference / Reason</label>
                  <Input
                    value={form.referenceNumber}
                    onChange={e => setForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="e.g., Stocktake 2025-12-24 / FBA short receive / Damage write-off"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    value={form.warehouseId}
                    onChange={e => setForm(prev => ({ ...prev, warehouseId: e.target.value }))}
                    disabled={submitting || session?.user.role === 'staff'}
                  >
                    <option value="">
                      {session?.user.role === 'staff' ? 'Assigned warehouse' : 'Select warehouse'}
                    </option>
                    {warehouses.map(warehouse => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                  {selectedWarehouse ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedWarehouse.name} ({selectedWarehouse.code})
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">SKU</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.skuId}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        skuId: e.target.value,
                        batchLot: '',
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">Select SKU</option>
                    {skus.map(sku => (
                      <option key={sku.id} value={sku.id}>
                        {sku.skuCode} — {sku.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Batch/Lot</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.batchLot}
                    onChange={e => setForm(prev => ({ ...prev, batchLot: e.target.value }))}
                    disabled={submitting || !form.skuId}
                  >
                    <option value="">{form.skuId ? 'Select batch/lot' : 'Select SKU first'}</option>
                    {batchOptions.map(batch => (
                      <option key={batch.id} value={batch.batchCode}>
                        {batch.batchCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Quantity (cartons)</label>
                  <Input
                    type="number"
                    value={form.quantity}
                    min={1}
                    onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes (optional)</label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Optional context to help audits"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Adjustment'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
              Inventory adjustments are immutable. Upload an “Adjustment Evidence” document on the next screen to keep the inventory ledger fully traceable.
            </div>
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

