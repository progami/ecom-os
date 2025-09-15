import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: { id: string; fileId: string } }

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.employeeFile.delete({ where: { id: params.fileId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 500 })
  }
}

