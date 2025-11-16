import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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

    type UpsertArgs = Parameters<typeof prisma.businessParameter.upsert>[0]
    const createData: UpsertArgs['create'] = { label: payload.label }
    const updateData: UpsertArgs['update'] = { label: payload.label }

    if ('valueNumeric' in payload && payload.valueNumeric != null) {
      const numeric = new Prisma.Decimal(payload.valueNumeric)
      createData.valueNumeric = numeric
      updateData.valueNumeric = numeric
    }

    if ('valueText' in payload && payload.valueText != null) {
      createData.valueText = payload.valueText
      updateData.valueText = payload.valueText
    }

    const parameter = await prisma.businessParameter.upsert({
      where: { label: payload.label },
      update: updateData,
      create: createData,
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
