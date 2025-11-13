import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const e = await prisma.employee.findFirst({ where: { OR: [{ id: params.id }, { employeeId: params.id }] }, include: { roles: true, dept: true } })
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(e)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const departmentName: string | null = body.department || body.departmentName || null
  const roles: string[] = Array.isArray(body.roles) ? body.roles.map((r: any) => String(r)) : []
  const updates: any = { ...body }
  if (departmentName) {
    updates.department = departmentName
    updates.dept = {
      connectOrCreate: { where: { name: departmentName }, create: { name: departmentName } }
    }
  }
  if (roles.length) {
    updates.roles = {
      set: [],
      connectOrCreate: roles.map((name) => ({ where: { name }, create: { name } }))
    }
  }
  const e = await prisma.employee.update({ where: { id: params.id }, data: updates, include: { roles: true, dept: true } })
  return NextResponse.json(e)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.employee.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
