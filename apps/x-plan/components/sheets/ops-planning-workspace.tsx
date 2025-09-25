'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import {
  OpsPlanningGrid,
  type OpsInputRow,
} from '@/components/sheets/ops-planning-grid'
import {
  OpsPlanningTimelineTable,
  type OpsTimelineRow,
} from '@/components/sheets/ops-planning-timeline'
import { OpsPlanningCostGrid } from '@/components/sheets/ops-planning-cost-grid'
import {
  PurchasePaymentsGrid,
  type PurchasePaymentRow,
  type PaymentSummary,
} from '@/components/sheets/purchase-payments-grid'
import {
  buildProductCostIndex,
  computePurchaseOrderDerived,
  type BusinessParameterMap,
  type ProductCostSummary,
  type ProductInput,
  type PurchaseOrderInput,
  type PurchaseOrderPaymentInput,
  type PurchaseOrderStatus,
  type LeadTimeProfile,
} from '@/lib/calculations'

export type PurchaseOrderSerialized = {
  id: string
  orderCode: string
  productId: string
  quantity: number
  productionWeeks?: number | null
  sourcePrepWeeks?: number | null
  oceanWeeks?: number | null
  finalMileWeeks?: number | null
  pay1Percent?: number | null
  pay2Percent?: number | null
  pay3Percent?: number | null
  pay1Amount?: number | null
  pay2Amount?: number | null
  pay3Amount?: number | null
  pay1Date?: string | null
  pay2Date?: string | null
  pay3Date?: string | null
  productionStart?: string | null
  productionComplete?: string | null
  sourceDeparture?: string | null
  portEta?: string | null
  inboundEta?: string | null
  availableDate?: string | null
  totalLeadDays?: number | null
  status: PurchaseOrderStatus
  transportReference?: string | null
  notes?: string | null
  payments?: Array<{
    paymentIndex: number
    percentage?: number | null
    amount?: number | null
    dueDate?: string | null
    status?: string | null
  }>
  overrideSellingPrice?: number | null
  overrideManufacturingCost?: number | null
  overrideFreightCost?: number | null
  overrideTariffRate?: number | null
  overrideTacosPercent?: number | null
  overrideFbaFee?: number | null
  overrideReferralRate?: number | null
  overrideStoragePerMonth?: number | null
}

export type OpsPlanningCalculatorPayload = {
  parameters: BusinessParameterMap
  products: ProductInput[]
  leadProfiles: Array<LeadTimeProfile & { productId: string }>
  purchaseOrders: PurchaseOrderSerialized[]
}

interface OpsPlanningWorkspaceProps {
  inputs: OpsInputRow[]
  timeline: OpsTimelineRow[]
  payments: PurchasePaymentRow[]
  calculator: OpsPlanningCalculatorPayload
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const DEFAULT_PROFILE: LeadTimeProfile = {
  productionWeeks: 0,
  sourcePrepWeeks: 0,
  oceanWeeks: 0,
  finalMileWeeks: 0,
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date).replace(',', '')
}

function formatNumericValue(value: number | null | undefined, fractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return ''
  return Number(value).toFixed(fractionDigits)
}

function formatPercentDecimalValue(value: number | null | undefined, fractionDigits = 4) {
  if (value == null || Number.isNaN(value)) return ''
  return Number(value).toFixed(fractionDigits)
}

function formatIntegerValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return ''
  return Math.round(Number(value)).toString()
}

function normalizePercent(value: string | undefined) {
  if (!value) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return value
  const base = numeric > 1 ? numeric / 100 : numeric
  return base.toFixed(4)
}

function normalizePaymentRows(rows: PurchasePaymentRow[]): PurchasePaymentRow[] {
  return rows.map((payment) => ({
    ...payment,
    dueDate: formatDisplayDate(payment.dueDate),
    percentage: normalizePercent(payment.percentage),
  }))
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value
  }
  const trimmed = value.trim()
  if (trimmed === '') return null
  const numeric = Number(trimmed)
  return Number.isNaN(numeric) ? null : numeric
}

function parseInteger(value: string | number | null | undefined, fallback: number): number {
  if (value == null) return fallback
  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : Math.round(value)
  }
  const trimmed = value.trim()
  if (trimmed === '') return fallback
  const numeric = Number(trimmed)
  return Number.isNaN(numeric) ? fallback : Math.round(numeric)
}

function parsePercent(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null
    return value > 1 ? value / 100 : value
  }
  const trimmed = value.trim()
  if (trimmed === '') return null
  const numeric = Number(trimmed)
  if (Number.isNaN(numeric)) return null
  return numeric > 1 ? numeric / 100 : numeric
}

function deserializeOrders(purchaseOrders: PurchaseOrderSerialized[]): PurchaseOrderInput[] {
  return purchaseOrders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    productId: order.productId,
    quantity: order.quantity,
    productionWeeks: order.productionWeeks ?? null,
    sourcePrepWeeks: order.sourcePrepWeeks ?? null,
    oceanWeeks: order.oceanWeeks ?? null,
    finalMileWeeks: order.finalMileWeeks ?? null,
    pay1Percent: order.pay1Percent ?? null,
    pay2Percent: order.pay2Percent ?? null,
    pay3Percent: order.pay3Percent ?? null,
    pay1Amount: order.pay1Amount ?? null,
    pay2Amount: order.pay2Amount ?? null,
    pay3Amount: order.pay3Amount ?? null,
    pay1Date: parseDateValue(order.pay1Date),
    pay2Date: parseDateValue(order.pay2Date),
    pay3Date: parseDateValue(order.pay3Date),
    productionStart: parseDateValue(order.productionStart),
    productionComplete: parseDateValue(order.productionComplete),
    sourceDeparture: parseDateValue(order.sourceDeparture),
    transportReference: order.transportReference ?? null,
    portEta: parseDateValue(order.portEta),
    inboundEta: parseDateValue(order.inboundEta),
    availableDate: parseDateValue(order.availableDate),
    totalLeadDays: order.totalLeadDays ?? null,
    status: order.status,
    notes: order.notes ?? null,
    payments:
      order.payments?.map((payment): PurchaseOrderPaymentInput => ({
        paymentIndex: payment.paymentIndex,
        percentage: payment.percentage ?? null,
        amount: payment.amount ?? null,
        dueDate: parseDateValue(payment.dueDate ?? null),
        status: payment.status ?? null,
      })) ?? [],
    overrideSellingPrice: order.overrideSellingPrice ?? null,
    overrideManufacturingCost: order.overrideManufacturingCost ?? null,
    overrideFreightCost: order.overrideFreightCost ?? null,
    overrideTariffRate: order.overrideTariffRate ?? null,
    overrideTacosPercent: order.overrideTacosPercent ?? null,
    overrideFbaFee: order.overrideFbaFee ?? null,
    overrideReferralRate: order.overrideReferralRate ?? null,
    overrideStoragePerMonth: order.overrideStoragePerMonth ?? null,
  }))
}

function mergeOrders(existing: PurchaseOrderInput[], rows: OpsInputRow[]): PurchaseOrderInput[] {
  const existingMap = new Map(existing.map((order) => [order.id, order]))
  return rows.map((row) => {
    const base = existingMap.get(row.id)
    if (!base) return {
      id: row.id,
      orderCode: row.orderCode,
      productId: row.productId,
      quantity: parseInteger(row.quantity, 0),
      productionWeeks: parseNumber(row.productionWeeks),
      sourcePrepWeeks: parseNumber(row.sourcePrepWeeks),
      oceanWeeks: parseNumber(row.oceanWeeks),
      finalMileWeeks: parseNumber(row.finalMileWeeks),
      pay1Percent: null,
      pay2Percent: null,
      pay3Percent: null,
      pay1Amount: null,
      pay2Amount: null,
      pay3Amount: null,
      pay1Date: parseDateValue(row.pay1Date),
      pay2Date: null,
      pay3Date: null,
      productionStart: null,
      productionComplete: null,
      sourceDeparture: null,
      transportReference: row.transportReference ? row.transportReference : null,
      portEta: null,
      inboundEta: null,
      availableDate: null,
      totalLeadDays: null,
      status: (row.status as PurchaseOrderStatus) ?? 'PLANNED',
      notes: row.notes ? row.notes : null,
      payments: [],
      overrideSellingPrice: parseNumber(row.sellingPrice),
      overrideManufacturingCost: parseNumber(row.manufacturingCost),
      overrideFreightCost: parseNumber(row.freightCost),
      overrideTariffRate: parsePercent(row.tariffRate),
      overrideTacosPercent: parsePercent(row.tacosPercent),
      overrideFbaFee: parseNumber(row.fbaFee),
      overrideReferralRate: parsePercent(row.referralRate),
      overrideStoragePerMonth: parseNumber(row.storagePerMonth),
    }

    return {
      ...base,
      productId: row.productId || base.productId,
      orderCode: row.orderCode,
      quantity: parseInteger(row.quantity, base.quantity ?? 0),
      pay1Date: parseDateValue(row.pay1Date),
      productionWeeks: parseNumber(row.productionWeeks),
      sourcePrepWeeks: parseNumber(row.sourcePrepWeeks),
      oceanWeeks: parseNumber(row.oceanWeeks),
      finalMileWeeks: parseNumber(row.finalMileWeeks),
      transportReference: row.transportReference ? row.transportReference : null,
      status: (row.status as PurchaseOrderStatus) ?? base.status,
      notes: row.notes ? row.notes : null,
      overrideSellingPrice: parseNumber(row.sellingPrice),
      overrideManufacturingCost: parseNumber(row.manufacturingCost),
      overrideFreightCost: parseNumber(row.freightCost),
      overrideTariffRate: parsePercent(row.tariffRate),
      overrideTacosPercent: parsePercent(row.tacosPercent),
      overrideFbaFee: parseNumber(row.fbaFee),
      overrideReferralRate: parsePercent(row.referralRate),
      overrideStoragePerMonth: parseNumber(row.storagePerMonth),
    }
  })
}

function buildPaymentsByOrder(paymentRows: PurchasePaymentRow[]): Map<string, PurchaseOrderPaymentInput[]> {
  const map = new Map<string, PurchaseOrderPaymentInput[]>()
  for (const payment of paymentRows) {
    const list = map.get(payment.purchaseOrderId) ?? []
    const percentage = payment.percentage != null && payment.percentage !== '' ? Number(payment.percentage) : null
    const amount = payment.amount != null && payment.amount !== '' ? Number(payment.amount) : null
    list.push({
      paymentIndex: payment.paymentIndex,
      percentage,
      amount,
      dueDate: parseDateValue(payment.dueDate),
      status: payment.status ?? null,
    })
    map.set(payment.purchaseOrderId, list)
  }
  return map
}

function formatCurrencyValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return currencyFormatter.format(value)
}

function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return `${(value * 100).toFixed(1)}%`
}

function buildTimelineRowsFromData(params: {
  orders: PurchaseOrderInput[]
  rows: OpsInputRow[]
  payments: PurchasePaymentRow[]
  productIndex: Map<string, ProductCostSummary>
  leadProfiles: Map<string, LeadTimeProfile>
  parameters: BusinessParameterMap
}): { timelineRows: OpsTimelineRow[]; derivedMap: Map<string, ReturnType<typeof computePurchaseOrderDerived>> } {
  const { orders, rows, payments, productIndex, leadProfiles, parameters } = params
  const ordersById = new Map(orders.map((order) => [order.id, order]))
  const paymentsByOrder = buildPaymentsByOrder(payments)
  const derivedMap = new Map<string, ReturnType<typeof computePurchaseOrderDerived>>()

  const timelineRows = rows.map((row): OpsTimelineRow => {
    const order = ordersById.get(row.id)
    if (!order) {
      return {
        id: row.id,
        orderCode: row.orderCode,
        productName: row.productName,
        landedUnitCost: '',
        poValue: '',
        paidAmount: '',
        paidPercent: '',
        productionStart: '',
        productionComplete: '',
        sourceDeparture: '',
        portEta: '',
        inboundEta: '',
        availableDate: '',
        totalLeadDays: '',
        weeksUntilArrival: '',
      }
    }

    const product = productIndex.get(order.productId)
    if (!product) {
      return {
        id: order.id,
        orderCode: order.orderCode,
        productName: row.productName,
        landedUnitCost: '',
        poValue: '',
        paidAmount: '',
        paidPercent: '',
        productionStart: '',
        productionComplete: '',
        sourceDeparture: '',
        portEta: '',
        inboundEta: '',
        availableDate: '',
        totalLeadDays: '',
        weeksUntilArrival: '',
      }
    }

    const profile = leadProfiles.get(order.productId) ?? DEFAULT_PROFILE
    const paymentsOverride = paymentsByOrder.get(order.id) ?? order.payments ?? []
    const derived = computePurchaseOrderDerived({ ...order, payments: paymentsOverride }, product, profile, parameters)
    derivedMap.set(order.id, derived)

    return {
      id: derived.id,
      orderCode: derived.orderCode,
      productName: row.productName,
      landedUnitCost: formatCurrencyValue(derived.landedUnitCost),
      poValue: formatCurrencyValue(derived.plannedPoValue),
      paidAmount: formatCurrencyValue(derived.paidAmount),
      paidPercent: formatPercentValue(derived.paidPercent),
      productionStart: formatDisplayDate(derived.productionStart),
      productionComplete: formatDisplayDate(derived.productionComplete),
      sourceDeparture: formatDisplayDate(derived.sourceDeparture),
      portEta: formatDisplayDate(derived.portEta),
      inboundEta: formatDisplayDate(derived.inboundEta),
      availableDate: formatDisplayDate(derived.availableDate),
      totalLeadDays: derived.totalLeadDays != null ? String(derived.totalLeadDays) : '',
      weeksUntilArrival: derived.weeksUntilArrival != null ? String(derived.weeksUntilArrival) : '',
    }
  })

  return { timelineRows, derivedMap }
}

function summaryLineFor(summary: PaymentSummary): string {
  const parts: string[] = []
  parts.push(`Manufacturing invoice ${currencyFormatter.format(summary.manufacturingInvoice)}`)
  parts.push(`Freight invoice ${currencyFormatter.format(summary.freightInvoice)}`)
  if (summary.plannedAmount > 0) {
    const paidPercent = Math.max(summary.actualPercent * 100, 0).toFixed(1)
    parts.push(`Paid ${currencyFormatter.format(summary.actualAmount)} (${paidPercent}%)`)
    if (summary.remainingAmount > 0.01) {
      parts.push(`Remaining ${currencyFormatter.format(summary.remainingAmount)}`)
    } else if (summary.remainingAmount < -0.01) {
      parts.push(`Cleared (+${currencyFormatter.format(Math.abs(summary.remainingAmount))})`)
    } else {
      parts.push('Cleared')
    }
  } else {
    parts.push(`Paid ${currencyFormatter.format(summary.actualAmount)}`)
  }
  return parts.join(' • ')
}

export function OpsPlanningWorkspace({ inputs, timeline, payments, calculator }: OpsPlanningWorkspaceProps) {
  const productIndex = useMemo(() => buildProductCostIndex(calculator.products), [calculator.products])
  const productMetadata = useMemo(() => {
    const map = new Map<string, { name: string; sku: string }>()
    for (const product of calculator.products) {
      map.set(product.id, { name: product.name, sku: product.sku ?? '' })
    }
    return map
  }, [calculator.products])
  const productOptionsForGrid = useMemo(
    () => calculator.products.map((product) => ({ id: product.id, sku: product.sku ?? '', name: product.name })),
    [calculator.products]
  )
  const leadProfileMap = useMemo(() => {
    const map = new Map<string, LeadTimeProfile>()
    for (const profile of calculator.leadProfiles) {
      map.set(profile.productId, {
        productionWeeks: Number(profile.productionWeeks ?? 0),
        sourcePrepWeeks: Number(profile.sourcePrepWeeks ?? 0),
        oceanWeeks: Number(profile.oceanWeeks ?? 0),
        finalMileWeeks: Number(profile.finalMileWeeks ?? 0),
      })
    }
    return map
  }, [calculator.leadProfiles])

  const initialOrders = useMemo(() => deserializeOrders(calculator.purchaseOrders), [calculator.purchaseOrders])
  const initialPayments = useMemo(() => normalizePaymentRows(payments), [payments])
  const initialTimelineResult = useMemo(
    () =>
      buildTimelineRowsFromData({
        orders: initialOrders,
        rows: inputs,
        payments: initialPayments,
        productIndex,
        leadProfiles: leadProfileMap,
        parameters: calculator.parameters,
      }),
    [initialOrders, inputs, initialPayments, productIndex, leadProfileMap, calculator.parameters]
  )

  const [inputRows, setInputRows] = useState<OpsInputRow[]>(inputs)
  const [timelineRows, setTimelineRows] = useState<OpsTimelineRow[]>(
    initialTimelineResult.timelineRows.length ? initialTimelineResult.timelineRows : timeline
  )
  const [orders, setOrders] = useState<PurchaseOrderInput[]>(initialOrders)
  const [paymentRows, setPaymentRows] = useState<PurchasePaymentRow[]>(initialPayments)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(inputs[0]?.id ?? null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inputRowsRef = useRef(inputRows)
  const ordersRef = useRef(orders)
  const paymentRowsRef = useRef(paymentRows)
  const derivedMapRef = useRef(initialTimelineResult.derivedMap)

  useEffect(() => {
    inputRowsRef.current = inputRows
  }, [inputRows])

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    paymentRowsRef.current = paymentRows
  }, [paymentRows])

  const applyTimelineUpdate = useCallback(
    (nextOrders: PurchaseOrderInput[], nextInputRows: OpsInputRow[], nextPayments: PurchasePaymentRow[]) => {
      const { timelineRows: newTimelineRows, derivedMap } = buildTimelineRowsFromData({
        orders: nextOrders,
        rows: nextInputRows,
        payments: nextPayments,
        productIndex,
        leadProfiles: leadProfileMap,
        parameters: calculator.parameters,
      })
      derivedMapRef.current = derivedMap
      setTimelineRows(newTimelineRows)
    },
    [productIndex, leadProfileMap, calculator.parameters]
  )

  useEffect(() => {
    setInputRows(inputs)
    applyTimelineUpdate(ordersRef.current, inputs, paymentRowsRef.current)
  }, [inputs, applyTimelineUpdate])

  useEffect(() => {
    const ordersFromServer = deserializeOrders(calculator.purchaseOrders)
    setOrders(ordersFromServer)
    ordersRef.current = ordersFromServer
    applyTimelineUpdate(ordersFromServer, inputRowsRef.current, paymentRowsRef.current)
  }, [calculator.purchaseOrders, applyTimelineUpdate])

  useEffect(() => {
    const normalized = normalizePaymentRows(payments)
    setPaymentRows(normalized)
    paymentRowsRef.current = normalized
    applyTimelineUpdate(ordersRef.current, inputRowsRef.current, normalized)
  }, [payments, applyTimelineUpdate])

  useEffect(() => {
    if (inputRows.length === 0) {
      setActiveOrderId(null)
      return
    }
    if (!activeOrderId || !inputRows.some((row) => row.id === activeOrderId)) {
      setActiveOrderId(inputRows[0].id)
    }
  }, [inputRows, activeOrderId])

  const handleInputRowsChange = useCallback(
    (updatedRows: OpsInputRow[]) => {
      setInputRows(updatedRows)
      const mergedOrders = mergeOrders(ordersRef.current, updatedRows)
      setOrders(mergedOrders)
      ordersRef.current = mergedOrders
      inputRowsRef.current = updatedRows
      applyTimelineUpdate(mergedOrders, updatedRows, paymentRowsRef.current)
    },
    [applyTimelineUpdate]
  )

  const handleAddOrder = useCallback(() => {
    if (!productOptionsForGrid.length) {
      toast.error('Add a product in Product setup before creating a PO')
      return
    }
    const orderCode = window.prompt('Enter PO code')
    const trimmedCode = orderCode?.trim()
    if (!trimmedCode) {
      toast.error('Enter a PO code to continue')
      return
    }

    const defaultProduct = productOptionsForGrid[0]
    setIsCreatingOrder(true)

    void (async () => {
      try {
        const response = await fetch('/api/v1/x-plan/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderCode: trimmedCode, productId: defaultProduct.id }),
        })
        if (!response.ok) throw new Error('Failed to create purchase order')
        const json = (await response.json()) as { order?: PurchaseOrderInput }
        const createdOrder = json.order
        if (!createdOrder) throw new Error('Missing order payload')

        const productInfo = productMetadata.get(createdOrder.productId) ?? { name: '', sku: '' }
        const nextRow: OpsInputRow = {
          id: createdOrder.id,
          productId: createdOrder.productId,
          productSku: productInfo.sku,
          orderCode: createdOrder.orderCode,
          transportReference: createdOrder.transportReference ?? '',
          productName: productInfo.name,
          quantity: formatIntegerValue(createdOrder.quantity ?? 0),
          pay1Date: formatDisplayDate(createdOrder.pay1Date),
          productionWeeks: formatNumericValue(createdOrder.productionWeeks),
          sourcePrepWeeks: formatNumericValue(createdOrder.sourcePrepWeeks),
          oceanWeeks: formatNumericValue(createdOrder.oceanWeeks),
          finalMileWeeks: formatNumericValue(createdOrder.finalMileWeeks),
          sellingPrice: formatNumericValue(createdOrder.overrideSellingPrice),
          manufacturingCost: formatNumericValue(createdOrder.overrideManufacturingCost),
          freightCost: formatNumericValue(createdOrder.overrideFreightCost),
          tariffRate: formatPercentDecimalValue(createdOrder.overrideTariffRate),
          tacosPercent: formatPercentDecimalValue(createdOrder.overrideTacosPercent),
          fbaFee: formatNumericValue(createdOrder.overrideFbaFee),
          referralRate: formatPercentDecimalValue(createdOrder.overrideReferralRate),
          storagePerMonth: formatNumericValue(createdOrder.overrideStoragePerMonth),
          status: createdOrder.status,
          notes: createdOrder.notes ?? '',
        }

        const nextOrders = [...ordersRef.current, createdOrder]
        const nextRows = [...inputRowsRef.current, nextRow]
        ordersRef.current = nextOrders
        inputRowsRef.current = nextRows
        setOrders(nextOrders)
        setInputRows(nextRows)
        applyTimelineUpdate(nextOrders, nextRows, paymentRowsRef.current)
        setActiveOrderId(createdOrder.id)
        toast.success('Purchase order created')
      } catch (error) {
        console.error(error)
        toast.error('Unable to create purchase order')
      } finally {
        setIsCreatingOrder(false)
      }
    })()
  }, [productOptionsForGrid, productMetadata, applyTimelineUpdate])

  const handleAddPayment = () => {
    const orderId = activeOrderId
    if (!orderId) {
      toast.error('Select a purchase order first')
      return
    }
    const summary = orderSummaries.get(orderId)
    if (isFullyAllocated(summary)) {
      toast.error('This PO is already fully cleared')
      return
    }
    const matchingPayments = paymentRows.filter((row) => row.purchaseOrderId === orderId)
    const nextIndex = matchingPayments.length ? Math.max(...matchingPayments.map((row) => row.paymentIndex)) + 1 : 1

    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/x-plan/purchase-order-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchaseOrderId: orderId, paymentIndex: nextIndex }),
        })
        if (!response.ok) throw new Error('Failed to add payment')
        const created = (await response.json()) as PurchasePaymentRow
        const normalizedCreated: PurchasePaymentRow = {
          ...created,
          dueDate: formatDisplayDate(created.dueDate),
          percentage: normalizePercent(created.percentage),
        }
        setPaymentRows((previous) => {
          const next = [...previous, normalizedCreated]
          paymentRowsRef.current = next
          applyTimelineUpdate(ordersRef.current, inputRowsRef.current, next)
          return next
        })
        toast.success('Payment added')
      } catch (error) {
        console.error(error)
        toast.error('Unable to add payment')
      }
    })
  }

  const handlePaymentRowsChange = useCallback(
    (rows: PurchasePaymentRow[]) => {
      const normalized = normalizePaymentRows(rows)
      paymentRowsRef.current = normalized
      setPaymentRows(normalized)
      applyTimelineUpdate(ordersRef.current, inputRowsRef.current, normalized)
    },
    [applyTimelineUpdate]
  )

  const orderSummaries = useMemo(() => {
    const summaries = new Map<string, PaymentSummary>()

    for (const row of timelineRows) {
      const derived = derivedMapRef.current.get(row.id)
      const manufacturingInvoice = derived?.manufacturingInvoice ?? 0
      const freightInvoice = derived?.freightInvoice ?? 0
      const plannedAmount = manufacturingInvoice + freightInvoice
      const plannedPercent = plannedAmount > 0 ? 1 : 0
      summaries.set(row.id, {
        plannedAmount,
        plannedPercent,
        actualAmount: 0,
        actualPercent: 0,
        remainingAmount: plannedAmount,
        remainingPercent: plannedPercent,
        manufacturingInvoice,
        freightInvoice,
      })
    }

    for (const payment of paymentRows) {
      const summary = summaries.get(payment.purchaseOrderId)
      if (!summary) continue
      const amountValue = payment.amount
      const amount = amountValue === '' || amountValue == null ? Number.NaN : Number(amountValue)
      const percentValue = payment.percentage
      const percentFromPayment = percentValue === '' || percentValue == null ? Number.NaN : Number(percentValue)

      if (Number.isFinite(percentFromPayment) && percentFromPayment > 0 && !Number.isFinite(amount)) {
        if (summary.plannedAmount > 0) {
          summary.actualAmount += percentFromPayment * summary.plannedAmount
        }
        continue
      }

      if (Number.isFinite(amount)) {
        summary.actualAmount += amount
      }
    }

    for (const summary of summaries.values()) {
      if (summary.plannedAmount > 0) {
        const impliedPercent = summary.actualAmount / summary.plannedAmount
        summary.actualPercent = Number.isFinite(impliedPercent) ? impliedPercent : 0
        summary.remainingAmount = summary.plannedAmount - summary.actualAmount
        summary.remainingPercent = summary.plannedPercent - summary.actualPercent
      } else {
        summary.actualAmount = 0
        summary.actualPercent = 0
        summary.remainingAmount = 0
        summary.remainingPercent = 0
      }
    }

    return summaries
  }, [timelineRows, paymentRows])

  const visiblePayments = useMemo(() => {
    if (!activeOrderId) return paymentRows
    return paymentRows.filter((payment) => payment.purchaseOrderId === activeOrderId)
  }, [activeOrderId, paymentRows])

  const isFullyAllocated = (summary: PaymentSummary | undefined) => {
    if (!summary) return false
    const amountTolerance = Math.max(summary.plannedAmount * 0.001, 0.01)
    const percentTolerance = Math.max(summary.plannedPercent * 0.001, 0.001)
    const amountCleared = summary.plannedAmount > 0 && Math.abs(summary.remainingAmount) <= amountTolerance
    const percentCleared = summary.plannedPercent > 0 && Math.abs(summary.remainingPercent) <= percentTolerance
    return amountCleared || percentCleared
  }

  const summaryLine = useMemo(() => {
    if (!activeOrderId) return null
    const summary = orderSummaries.get(activeOrderId)
    if (!summary) return null
    return summaryLineFor(summary)
  }, [orderSummaries, activeOrderId])

  return (
    <div className="space-y-6">
      <OpsPlanningGrid
        rows={inputRows}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
        onRowsChange={handleInputRowsChange}
        onAddOrder={handleAddOrder}
        isAddingOrder={isCreatingOrder}
      />
      <OpsPlanningCostGrid
        rows={inputRows}
        products={productOptionsForGrid}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
        onRowsChange={handleInputRowsChange}
      />
      <PurchasePaymentsGrid
        payments={visiblePayments}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
        onAddPayment={handleAddPayment}
        onRowsChange={handlePaymentRowsChange}
        isLoading={isPending}
        orderSummaries={orderSummaries}
        summaryLine={summaryLine ?? undefined}
      />
      <OpsPlanningTimelineTable
        rows={timelineRows}
        activeOrderId={activeOrderId}
        onSelectOrder={(orderId) => setActiveOrderId(orderId)}
      />
    </div>
  )
}
