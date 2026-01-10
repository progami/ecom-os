import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@targon/prisma-talos'
import { getS3Service } from '@/services/s3.service'
import { validateFile, scanFileContent } from '@/lib/security/file-upload'

type RateListAttachmentRecord = {
  fileName: string
  s3Key: string
  size: number
  contentType: string
  uploadedAt: string
  uploadedBy?: string | null
}

const parseAttachmentRecord = (
  value: Prisma.JsonValue | null
): RateListAttachmentRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  if (typeof record.s3Key !== 'string' || typeof record.fileName !== 'string') {
    return null
  }

  return {
    fileName: record.fileName,
    s3Key: record.s3Key,
    size: typeof record.size === 'number' ? record.size : 0,
    contentType:
      typeof record.contentType === 'string'
        ? record.contentType
        : 'application/octet-stream',
    uploadedAt:
      typeof record.uploadedAt === 'string' ? record.uploadedAt : new Date().toISOString(),
    uploadedBy: typeof record.uploadedBy === 'string' ? record.uploadedBy : null,
  }
}

const toClientAttachment = (record: RateListAttachmentRecord, downloadUrl?: string) => ({
  fileName: record.fileName,
  size: record.size,
  contentType: record.contentType,
  uploadedAt: record.uploadedAt,
  uploadedBy: record.uploadedBy,
  downloadUrl,
})

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getTenantPrisma()
    const { id } = await params
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: { rateListAttachment: true },
    })

    if (!warehouse || !warehouse.rateListAttachment) {
      return NextResponse.json({ attachment: null }, { status: 404 })
    }

    const record = parseAttachmentRecord(warehouse.rateListAttachment as Prisma.JsonValue)
    if (!record) {
      return NextResponse.json({ attachment: null }, { status: 404 })
    }

    const s3Service = getS3Service()
    const downloadUrl = await s3Service.getPresignedUrl(record.s3Key, 'get', {
      expiresIn: 5 * 60,
    })

    return NextResponse.json({ attachment: toClientAttachment(record, downloadUrl) })
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to load rate list attachment' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getTenantPrisma()
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const validation = await validateFile(file, 'warehouse-document')
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const scanResult = await scanFileContent(buffer, file.type)
    if (!scanResult.valid) {
      return NextResponse.json({ error: scanResult.error }, { status: 400 })
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: { rateListAttachment: true },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    const existingRecord = parseAttachmentRecord(
      warehouse.rateListAttachment as Prisma.JsonValue | null
    )

    const s3Service = getS3Service()
    const s3Key = s3Service.generateKey(
      { type: 'warehouse-rate-list', warehouseId: id },
      file.name
    )

    await s3Service.uploadFile(buffer, s3Key, {
      contentType: file.type,
      metadata: {
        warehouseId: id,
        originalName: file.name,
        uploadedBy: session.user.email || session.user.id,
      },
    })

    if (existingRecord?.s3Key) {
      try {
        await s3Service.deleteFile(existingRecord.s3Key)
      } catch {
        // Ignore deletion failures
      }
    }

    const attachmentRecord: RateListAttachmentRecord = {
      fileName: file.name,
      s3Key,
      size: file.size,
      contentType: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.user.email || session.user.id,
    }

    await prisma.warehouse.update({
      where: { id },
      data: {
        rateListAttachment: attachmentRecord as unknown as Prisma.InputJsonValue,
      },
    })

    const downloadUrl = await s3Service.getPresignedUrl(s3Key, 'get', { expiresIn: 5 * 60 })

    return NextResponse.json({
      attachment: toClientAttachment(attachmentRecord, downloadUrl),
      message: 'Rate list uploaded successfully',
    })
  } catch (_error) {
    console.error('Rate list upload failed', _error)
    const message = _error instanceof Error ? _error.message : 'Failed to upload file'
    return NextResponse.json({ error: 'Failed to upload file', details: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getTenantPrisma()
    const { id } = await params
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: { rateListAttachment: true },
    })

    if (!warehouse || !warehouse.rateListAttachment) {
      return NextResponse.json({ error: 'No attachment to delete' }, { status: 404 })
    }

    const record = parseAttachmentRecord(warehouse.rateListAttachment as Prisma.JsonValue)
    const s3Service = getS3Service()

    if (record?.s3Key) {
      try {
        await s3Service.deleteFile(record.s3Key)

        // Clean up any other files in the same rate-list folder to avoid S3 clutter
        const folderPrefix = record.s3Key.slice(0, record.s3Key.lastIndexOf('/') + 1)
        if (folderPrefix) {
          const keys = await s3Service.listFiles(folderPrefix)
          for (const key of keys) {
            if (key !== record.s3Key) {
              await s3Service.deleteFile(key)
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    await prisma.warehouse.update({
      where: { id },
      data: { rateListAttachment: Prisma.JsonNull },
    })

    return NextResponse.json({ success: true, message: 'Rate list removed' })
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
