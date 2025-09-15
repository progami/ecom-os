import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getDefaultStorage } from '@/app/hrms/lib/storage'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const files = await prisma.employeeFile.findMany({ where: { employeeId: params.id }, orderBy: { uploadedAt: 'desc' } })
  return NextResponse.json({ items: files })
}

export async function POST(req: Request, { params }: Params) {
  try {
    const contentType = req.headers.get('content-type') || ''
    // If multipart form-data, handle file upload
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      const title = (form.get('title') as string | null) || (file?.name ?? null)
      if (!file || !title) return NextResponse.json({ error: 'Missing file or title' }, { status: 400 })
      const arrayBuffer = await file.arrayBuffer()
      const key = `employees/${params.id}/${Date.now()}-${file.name}`
      const storage = getDefaultStorage()
      const url = await storage.upload({ key, contentType: (file as any).type || 'application/octet-stream', body: arrayBuffer })
      const created = await prisma.employeeFile.create({
        data: { employeeId: params.id, title, fileUrl: url },
      })
      return NextResponse.json(created, { status: 201 })
    }

    // Fallback: JSON body with direct fileUrl or key
    const body = await req.json()
    if (!body.title) return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    let fileUrl = body.fileUrl as string | undefined
    if (!fileUrl && body.key) {
      const region = process.env.S3_BUCKET_REGION || process.env.S3_REGION || 'us-east-1'
      const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET
      const base = process.env.S3_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`
      fileUrl = `${base}/${body.key}`
    }
    if (!fileUrl) return NextResponse.json({ error: 'Missing fileUrl or key' }, { status: 400 })
    const created = await prisma.employeeFile.create({
      data: { employeeId: params.id, title: body.title, fileUrl },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to add file' }, { status: 500 })
  }
}
