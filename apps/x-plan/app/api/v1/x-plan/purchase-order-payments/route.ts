import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

type UpdatePayload = {
  id: string
  values: Record<string, string | null | undefined>
}

const allowedFields = ['paymentDate', 'percentage', 'amount', 'status'] as const

function parseNumber(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[$,%]/g, '')
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PUT(request: Request) {
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
        if (incoming === null || incoming === undefined || incoming === '') {
          if (field === 'paymentDate') {
            data.paymentDate = null
          } else {
            data[field] = null
          }
          continue
        }

        if (field === 'paymentDate') {
          data.paymentDate = parseDate(incoming)
        } else if (field === 'percentage') {
          const parsed = parseNumber(incoming)
          data[field] = parsed == null ? null : parsed > 1 ? parsed / 100 : parsed
        } else if (field === 'amount') {
          data[field] = parseNumber(incoming)
        } else if (field === 'status') {
          data[field] = incoming
        }
      }

      if (Object.keys(data).length === 0) {
        return prisma.purchaseOrderPayment.findUnique({ where: { id } })
      }

        return prisma.purchaseOrderPayment.update({ where: { id }, data })
    })
  )

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.purchaseOrderId !== 'string') {
    return NextResponse.json({ error: 'purchaseOrderId is required' }, { status: 400 })
  }

  const purchaseOrderId: string = body.purchaseOrderId
  const paymentIndex: number = Number(body.paymentIndex ?? 1)
  const percentage = parseNumber(body.percentage ?? null)
  const amount = parseNumber(body.amount ?? null)
  const paymentDate = parseDate(body.paymentDate ?? null)

  try {
    const nextIndex = Number.isNaN(paymentIndex) ? 1 : paymentIndex
    const created = await prisma.purchaseOrderPayment.create({
      data: {
        purchaseOrderId,
        paymentIndex: nextIndex,
        percentage: percentage != null ? new Prisma.Decimal(percentage.toFixed(4)) : null,
        amount: amount != null ? new Prisma.Decimal(amount.toFixed(2)) : null,
        paymentDate,
      },
      include: { purchaseOrder: true },
    })

    return NextResponse.json({
      id: created.id,
      purchaseOrderId: created.purchaseOrderId,
      orderCode: created.purchaseOrder.orderCode,
      paymentIndex: created.paymentIndex,
      paymentDate: created.paymentDate?.toISOString() ?? '',
      percentage: created.percentage ? Number(created.percentage).toFixed(2) : '',
      amount: created.amount ? Number(created.amount).toFixed(2) : '',
      status: created.status,
    })
  } catch (error) {
    console.error('[purchase-order-payments][POST]', error)
    return NextResponse.json({ error: 'Unable to create payment' }, { status: 500 })
  }
}
