import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)
    const department = searchParams.get('department') || undefined
    const status = searchParams.get('status') || undefined
    const employmentType = searchParams.get('employmentType') || undefined
    const joined = searchParams.get('joined') || undefined // last_30_days, last_3_months, last_6_months, last_year
    const employeeId = searchParams.get('employeeId') || undefined

    const where: any = {}
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (employeeId) where.employeeId = employeeId
    if (department) where.department = department
    if (status) where.status = status.toUpperCase()
    if (employmentType) where.employmentType = employmentType.toUpperCase()
    if (joined) {
      const now = new Date()
      let from: Date | null = null
      if (joined === 'last_30_days') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      if (joined === 'last_3_months') from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      if (joined === 'last_6_months') from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      if (joined === 'last_year') from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      if (from) where.joinDate = { gte: from }
    }

    const [items, total] = await Promise.all([
      prisma.employee.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.employee.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const required = ['employeeId', 'firstName', 'lastName', 'email', 'department', 'position', 'employmentType', 'joinDate']
    for (const key of required) {
      if (!body[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 400 })
    }

    const employee = await prisma.employee.create({
      data: {
        employeeId: body.employeeId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone ?? null,
        avatar: body.avatar ?? null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender ?? null,
        maritalStatus: body.maritalStatus ?? null,
        nationality: body.nationality ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        country: body.country ?? null,
        postalCode: body.postalCode ?? null,
        department: body.department,
        position: body.position,
        employmentType: body.employmentType,
        joinDate: new Date(body.joinDate),
        status: body.status || 'ACTIVE',
        reportsTo: body.reportsTo ?? null,
        salary: body.salary ?? null,
        currency: body.currency || 'USD',
        emergencyContact: body.emergencyContact ?? null,
        emergencyPhone: body.emergencyPhone ?? null,
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create employee' }, { status: 500 })
  }
}
