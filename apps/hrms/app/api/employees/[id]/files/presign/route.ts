import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

type Params = { params: { id: string } }

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$|\.+$/g, '')
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { filename, contentType } = await req.json()
    if (!filename) return NextResponse.json({ error: 'Missing filename' }, { status: 400 })
    const region = process.env.S3_BUCKET_REGION || process.env.S3_REGION || 'us-east-1'
    const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 })
    const prefix = process.env.S3_PREFIX || process.env.S3_PARENT_PREFIX || 'hrms-dev'

    const safe = sanitizeFileName(filename)
    const key = `${prefix}/employees/${params.id}/${Date.now()}-${safe}`

    const client = new S3Client({
      region,
      credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      } : undefined,
    })

    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || 'application/octet-stream' })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 }) // 5 minutes
    const base = process.env.S3_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`
    const publicUrl = `${base}/${key}`

    return NextResponse.json({ uploadUrl, key, publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to presign' }, { status: 500 })
  }
}

