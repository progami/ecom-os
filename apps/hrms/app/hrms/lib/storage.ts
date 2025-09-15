// Storage adapter placeholder for long-term file storage
// For production, configure AWS S3 credentials via env vars:
// - S3_REGION
// - S3_BUCKET
// - S3_ACCESS_KEY_ID
// - S3_SECRET_ACCESS_KEY
// You can swap implementation later without changing callers.

export type UploadParams = {
  key: string
  contentType: string
  body: ArrayBuffer | Buffer | Uint8Array
  cacheControl?: string
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<string> // returns public URL or key
  delete(key: string): Promise<void>
}

export class S3Provider implements StorageProvider {
  private client: any
  constructor(
    private opts: {
      region: string
      bucket: string
      accessKeyId?: string
      secretAccessKey?: string
      publicBaseUrl?: string
    }
  ) {
    const { S3Client } = require('@aws-sdk/client-s3')
    this.client = new S3Client({
      region: opts.region,
      credentials: opts.accessKeyId && opts.secretAccessKey ? {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      } : undefined,
    })
  }

  async upload(params: UploadParams): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3')
    const body = Buffer.isBuffer(params.body)
      ? params.body
      : (params.body instanceof ArrayBuffer ? Buffer.from(params.body) : Buffer.from(params.body))
    const command = new PutObjectCommand({
      Bucket: this.opts.bucket,
      Key: params.key,
      Body: body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
    })
    await this.client.send(command)
    const base = this.opts.publicBaseUrl || `https://${this.opts.bucket}.s3.${this.opts.region}.amazonaws.com`
    return `${base}/${params.key}`
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }))
  }
}

export function getDefaultStorage(): StorageProvider {
  const region = process.env.S3_BUCKET_REGION || process.env.S3_REGION || 'us-east-1'
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || 'example-bucket'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL

  return new S3Provider({ region, bucket, accessKeyId, secretAccessKey, publicBaseUrl })
}
