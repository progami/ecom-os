import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type UpdatePayload = {
  id: string
  values: Record<string, string | null | undefined>
}

const allowedFields = ['dueDate', 'percentage', 'amount', 'status'] as const

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
          data[field] = null
          continue
        }

        if (field === 'dueDate') {
          data[field] = parseDate(incoming)
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
