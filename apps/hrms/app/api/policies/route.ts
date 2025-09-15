import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)
    const category = searchParams.get('category') || undefined
    const status = searchParams.get('status') || undefined

    const where: any = {}
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (category) where.category = String(category).toUpperCase()
    if (status) where.status = String(status).toUpperCase()

    const [items, total] = await Promise.all([
      prisma.policy.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.policy.count({ where })
    ])
    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch policies' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.title || !body.category) return NextResponse.json({ error: 'Missing title or category' }, { status: 400 })

    const item = await prisma.policy.create({
      data: {
        title: body.title,
        category: String(body.category).toUpperCase() as any,
        summary: body.summary ?? null,
        status: (body.status ? String(body.status) : 'ACTIVE').toUpperCase() as any,
      }
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create policy' }, { status: 500 })
  }
}
