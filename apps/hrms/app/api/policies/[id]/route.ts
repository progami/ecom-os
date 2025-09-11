import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const item = await prisma.policy.findUnique({ where: { id: params.id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json()
    if (body.effectiveDate) body.effectiveDate = new Date(body.effectiveDate)
    const updated = await prisma.policy.update({ where: { id: params.id }, data: body })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.policy.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 500 })
  }
}

