import { NextResponse } from 'next/server'
import { Prisma } from '@ecom-os/prisma-x-plan'
import prisma from '@/lib/prisma'
import { withXPlanAuth } from '@/lib/api/auth'

type UpdatePayload = {
  id: string
  values: Record<string, string | null | undefined>
}

const allowedFields = ['dueDate', 'dueDateDefault', 'dueDateSource', 'percentage', 'amountExpected', 'amountPaid'] as const

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
}

export const PUT = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updates = body.updates as UpdatePayload[]

  await prisma.$transaction(
    updates.map(({ id, values }) => {
      const data: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (!(field in values)) continue
        const incoming = values[field]
        if (incoming === undefined) {
          continue
        }

        if (field === 'dueDateSource') {
          const normalized = String(incoming).trim().toUpperCase()
          if (normalized === 'USER' || normalized === 'SYSTEM') {
            data[field] = normalized
          }
          continue
        }

        if (incoming === null || incoming === '') {
          data[field] = null
          continue
        }

        if (field === 'dueDate' || field === 'dueDateDefault') {
          data[field] = parseDate(incoming)
        } else if (field === 'percentage') {
          const parsed = parseNumber(incoming)
          const decimal = parsed == null ? null : parsed > 1 ? parsed / 100 : parsed
          data[field] = decimal == null ? null : new Prisma.Decimal(decimal.toFixed(4))
        } else if (field === 'amountExpected' || field === 'amountPaid') {
          const parsed = parseNumber(incoming)
          data[field] = parsed == null ? null : new Prisma.Decimal(parsed.toFixed(2))
        }
      }

      if (Object.keys(data).length === 0) {
        return prisma.purchaseOrderPayment.findUnique({ where: { id } })
      }

      return prisma.purchaseOrderPayment.update({ where: { id }, data })
    })
  )

  return NextResponse.json({ ok: true })
})

export const POST = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.purchaseOrderId !== 'string') {
    return NextResponse.json({ error: 'purchaseOrderId is required' }, { status: 400 })
  }

  const purchaseOrderId: string = body.purchaseOrderId
  const paymentIndex: number = Number(body.paymentIndex ?? 1)
  const percentage = parseNumber(body.percentage ?? null)
  const amountExpected = parseNumber(body.amountExpected ?? null)
  const amountPaid = parseNumber(body.amountPaid ?? null)
  const dueDate = parseDate(body.dueDate ?? null)
  const dueDateSource = String(body.dueDateSource ?? 'SYSTEM').trim().toUpperCase()
  const normalizedSource = dueDateSource === 'USER' ? 'USER' : 'SYSTEM'
  const label = typeof body.label === 'string' && body.label.trim().length > 0 ? body.label.trim() : undefined
  const category = typeof body.category === 'string' && body.category.trim().length > 0 ? body.category.trim() : undefined

  try {
    const nextIndex = Number.isNaN(paymentIndex) ? 1 : paymentIndex
    const created = await prisma.purchaseOrderPayment.create({
      data: {
        purchaseOrderId,
        paymentIndex: nextIndex,
        percentage: percentage != null ? new Prisma.Decimal(percentage.toFixed(4)) : null,
        amountExpected: amountExpected != null ? new Prisma.Decimal(amountExpected.toFixed(2)) : null,
        amountPaid: amountPaid != null ? new Prisma.Decimal(amountPaid.toFixed(2)) : null,
        dueDate,
        dueDateDefault: dueDate,
        dueDateSource: normalizedSource,
        label: label ?? `Payment ${nextIndex}`,
        category: category ?? 'OTHER',
      },
      include: { purchaseOrder: true },
    })

    const toIsoDate = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null)
    const dueDateIso = toIsoDate(created.dueDate)
    const dueDateDefaultIso = toIsoDate(created.dueDateDefault ?? created.dueDate)

    return NextResponse.json({
      id: created.id,
      purchaseOrderId: created.purchaseOrderId,
      orderCode: created.purchaseOrder.orderCode,
      paymentIndex: created.paymentIndex,
      category: created.category ?? '',
      label: created.label ?? '',
      weekNumber: '',
      dueDate: dueDateIso ?? '',
      dueDateIso,
      dueDateDefault: dueDateDefaultIso ?? '',
      dueDateDefaultIso,
      dueDateSource: created.dueDateSource,
      percentage: created.percentage ? Number(created.percentage).toFixed(2) : '',
      amountExpected: created.amountExpected ? Number(created.amountExpected).toFixed(2) : '',
      amountPaid: created.amountPaid ? Number(created.amountPaid).toFixed(2) : '',
    })
  } catch (error) {
    console.error('[purchase-order-payments][POST]', error)
    return NextResponse.json({ error: 'Unable to create payment' }, { status: 500 })
  }
})

export const DELETE = withXPlanAuth(async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  const ids = body.ids as string[]

  try {
    await prisma.purchaseOrderPayment.deleteMany({
      where: { id: { in: ids } },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[purchase-order-payments][DELETE]', error)
    return NextResponse.json({ error: 'Unable to delete payments' }, { status: 500 })
  }
})
