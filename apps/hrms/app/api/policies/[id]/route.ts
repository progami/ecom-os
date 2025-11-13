import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'

type PolicyRouteContext = { params: { id: string } }

function extractParams(context: unknown): PolicyRouteContext['params'] {
  return (context as PolicyRouteContext).params
}

export async function GET(_req: Request, context: unknown) {
  const params = extractParams(context)
  const p = await prisma.policy.findUnique({ where: { id: params.id } })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(p)
}

export async function PATCH(req: Request, context: unknown) {
  const params = extractParams(context)
  try {
    const body = await req.json()
    const updates: any = {}
    if ('title' in body) updates.title = String(body.title)
    if ('category' in body) updates.category = String(body.category).toUpperCase()
    if ('summary' in body) updates.summary = body.summary ?? null
    if ('content' in body) updates.content = body.content ?? null
    if ('fileUrl' in body) updates.fileUrl = body.fileUrl ?? null
    if ('version' in body) updates.version = body.version ?? null
    if ('effectiveDate' in body) updates.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null
    if ('status' in body) updates.status = String(body.status).toUpperCase()

    const p = await prisma.policy.update({ where: { id: params.id }, data: updates })
    return NextResponse.json(p)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update policy' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: unknown) {
  const params = extractParams(context)
  try {
    await prisma.policy.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
