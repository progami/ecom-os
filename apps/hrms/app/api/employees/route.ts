import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { EmploymentType, EmployeeStatus } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').toLowerCase()
    const take = Number(searchParams.get('take') || 50)
    const skip = Number(searchParams.get('skip') || 0)
    const where: any = {}
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
      ]
    }
    const employeeId = searchParams.get('employeeId')
    if (employeeId) where.employeeId = employeeId
    const department = searchParams.get('department')
    const status = searchParams.get('status')
    const employmentType = searchParams.get('employmentType')
    if (department) where.department = department
    if (status) where.status = status.toUpperCase()
    if (employmentType) where.employmentType = employmentType.toUpperCase()

    const [items, total] = await Promise.all([
      prisma.employee.findMany({ where, take, skip, orderBy: { createdAt: 'desc' }, include: { roles: true, dept: true } }),
      prisma.employee.count({ where })
    ])
    return NextResponse.json({ items, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const required = ['employeeId','firstName','lastName','email','position','employmentType','joinDate']
    for (const k of required) {
      if (!body[k]) return NextResponse.json({ error: `Missing ${k}` }, { status: 400 })
    }
    const departmentName: string | null = body.department || body.departmentName || null
    const roles: string[] = Array.isArray(body.roles) ? body.roles.map((r: any) => String(r)) : []

    const emp = await prisma.employee.create({
      data: {
        employeeId: body.employeeId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone ?? null,
        department: departmentName || 'General',
        position: body.position,
        employmentType: String(body.employmentType || 'FULL_TIME').toUpperCase() as EmploymentType,
        joinDate: new Date(body.joinDate),
        status: String(body.status || 'ACTIVE').toUpperCase() as EmployeeStatus,
        dept: departmentName ? {
          connectOrCreate: {
            where: { name: departmentName },
            create: { name: departmentName }
          }
        } : undefined,
        roles: roles.length ? {
          connectOrCreate: roles.map((name) => ({ where: { name }, create: { name } }))
        } : undefined
      },
      include: { roles: true, dept: true }
    })
    return NextResponse.json(emp, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create employee' }, { status: 500 })
  }
}
