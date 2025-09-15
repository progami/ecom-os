import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)
    const category = searchParams.get('category') || undefined
    const subs = [...searchParams.getAll('subcategory')]
    const csv = (searchParams.get('subcategories') || '').split(',').map(s => s.trim()).filter(Boolean)
    const subcategories = [...subs, ...csv]

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (category) where.category = String(category).toUpperCase()
    if (subcategories.length) where.subcategory = { in: subcategories }

    const [items, total] = await Promise.all([
      prisma.resource.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.resource.count({ where })
    ])
    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch resources' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name || !body.category) return NextResponse.json({ error: 'Missing name or category' }, { status: 400 })

    const category = String(body.category).toUpperCase()
    const rating = body.rating === undefined || body.rating === null ? null : Number(body.rating)

    // Simple de-duplication by website if provided
    if (body.website) {
      const existing = await prisma.resource.findFirst({ where: { website: body.website } })
      if (existing) return NextResponse.json(existing)
    }

    const item = await prisma.resource.create({
      data: {
        name: body.name,
        category: category as any,
        subcategory: body.subcategory ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        description: body.description ?? null,
        rating,
      }
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create resource' }, { status: 500 })
  }
}
