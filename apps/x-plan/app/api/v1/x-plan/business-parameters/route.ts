import { NextResponse } from 'next/server'
import { Prisma } from '@ecom-os/prisma-x-plan'
import prisma from '@/lib/prisma'

type UpdatePayload = {
  id: string
  valueNumeric?: string
  valueText?: string
}

type CreatePayload = {
  label: string
  valueNumeric?: number
  valueText?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = body as CreatePayload

    if (!payload?.label) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    }

    const numericValue =
      'valueNumeric' in payload && payload.valueNumeric != null
        ? new Prisma.Decimal(payload.valueNumeric)
        : undefined

    const textValue = 'valueText' in payload && payload.valueText != null ? payload.valueText : undefined

    const parameter = await prisma.businessParameter.upsert({
      where: { label: payload.label },
      update: {
        ...(numericValue !== undefined ? { valueNumeric: numericValue } : {}),
        ...(textValue !== undefined ? { valueText: textValue } : {}),
      },
      create: {
        label: payload.label,
        ...(numericValue !== undefined ? { valueNumeric: numericValue } : {}),
        ...(textValue !== undefined ? { valueText: textValue } : {}),
      },
    })

    return NextResponse.json({ parameter })
  } catch (error) {
    console.error('[business-parameters][POST]', error)
    return NextResponse.json({ error: 'Unable to create business parameter' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const updates = Array.isArray(body?.updates) ? (body.updates as UpdatePayload[]) : []
    if (updates.length === 0) {
      return NextResponse.json({ ok: true })
    }

    await Promise.all(
      updates.map(async (update) => {
        if (!update?.id) return

        const data: Record<string, unknown> = {}

        if ('valueNumeric' in update) {
          if (update.valueNumeric === '' || update.valueNumeric == null) {
            data.valueNumeric = null
          } else {
            const numeric = Number(update.valueNumeric)
            if (!Number.isNaN(numeric)) {
              data.valueNumeric = new Prisma.Decimal(numeric.toFixed(2))
            }
          }
        }

        if ('valueText' in update) {
          data.valueText = update.valueText ?? null
        }

        if (Object.keys(data).length === 0) return

        await prisma.businessParameter.update({
          where: { id: update.id },
          data,
        })
      })
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[business-parameters][PUT]', error)
    return NextResponse.json({ error: 'Unable to update business parameters' }, { status: 500 })
  }
}
