import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || undefined
    const status = searchParams.get('status') || undefined
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)

    const where: any = {}
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }]
    if (category) where.category = category
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.policy.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.policy.count({ where }),
    ])
    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load policies' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.title || !body.category) return NextResponse.json({ error: 'Missing title or category' }, { status: 400 })

    const policy = await prisma.policy.create({
      data: {
        title: body.title,
        category: body.category,
        summary: body.summary ?? null,
        content: body.content ?? null,
        fileUrl: body.fileUrl ?? null,
        version: body.version ?? null,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        status: body.status || 'ACTIVE',
      },
    })
    return NextResponse.json(policy, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create policy' }, { status: 500 })
  }
}
