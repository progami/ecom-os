import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || undefined
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)
    // Support multi-select: allow multiple subcategory params and/or CSV
    const multi = searchParams.getAll('subcategory')
    const csv = (searchParams.get('subcategories') || '').split(',').map(s => s.trim()).filter(Boolean)
    const subcategories = [...multi, ...csv]

    const where: any = {}
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }]
    if (category) where.category = category
    if (subcategories.length > 0) where.subcategory = { in: subcategories }

    const [items, total] = await Promise.all([
      prisma.resource.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.resource.count({ where }),
    ])
    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load resources' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name || !body.category) return NextResponse.json({ error: 'Missing name or category' }, { status: 400 })
    // Prevent duplicates: try to find existing by website or by (name, category, subcategory)
    const existing = await prisma.resource.findFirst({
      where: {
        OR: [
          body.website ? { website: body.website } : undefined,
          {
            name: body.name,
            category: body.category,
            subcategory: body.subcategory ?? null,
          },
        ].filter(Boolean) as any,
      },
    })
    if (existing) return NextResponse.json(existing, { status: 200 })
    const item = await prisma.resource.create({
      data: {
        name: body.name,
        category: body.category,
        subcategory: body.subcategory ?? null,
        description: body.description ?? null,
        contactName: body.contactName ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        country: body.country ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        rating: body.rating ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create resource' }, { status: 500 })
  }
}
