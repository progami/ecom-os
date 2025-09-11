import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  let item = await prisma.employee.findUnique({ where: { id: params.id } })
  if (!item) {
    // Fallback: support /employees/{employeeId}
    item = await prisma.employee.findUnique({ where: { employeeId: params.id } })
  }
  if (!item) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json()
    const data: any = { ...body }
    if (body.joinDate) data.joinDate = new Date(body.joinDate)
    if (body.dateOfBirth) data.dateOfBirth = new Date(body.dateOfBirth)
    const updated = await prisma.employee.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.employee.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 500 })
  }
}
