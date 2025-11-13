import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await prisma.resource.findUnique({ where: { id: params.id } })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(r)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updates: any = {}
    if ('name' in body) updates.name = String(body.name)
    if ('category' in body) updates.category = String(body.category).toUpperCase()
    if ('subcategory' in body) updates.subcategory = body.subcategory ?? null
    if ('email' in body) updates.email = body.email ?? null
    if ('phone' in body) updates.phone = body.phone ?? null
    if ('website' in body) updates.website = body.website ?? null
    if ('description' in body) updates.description = body.description ?? null
    if ('rating' in body) updates.rating = body.rating === undefined || body.rating === null ? null : Number(body.rating)

    const r = await prisma.resource.update({ where: { id: params.id }, data: updates })
    return NextResponse.json(r)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update resource' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.resource.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
