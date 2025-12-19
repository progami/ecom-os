import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'
import { getS3Service } from '@/services/s3.service'
import { validateFile } from '@/lib/security/file-upload'

export const dynamic = 'force-dynamic'

interface PresignedUrlRequest {
 fileName: string
 fileType: string
 fileSize: number
 context: {
 type: 'transaction'
 transactionId: string
 documentType: string
 }
}

export const POST = withAuth(async (request, session) => {
 try {

 const body: PresignedUrlRequest = await request.json()
 const { fileName, fileType, fileSize, context } = body

 // Validate request
 if (!fileName || !fileType || !fileSize || !context) {
 return NextResponse.json({ 
 error: 'Missing required fields: fileName, fileType, fileSize, context' 
 }, { status: 400 })
 }

 // Validate file before generating presigned URL
 const validation = await validateFile(
 { name: fileName, size: fileSize, type: fileType },
 'transaction-attachment'
 )
 
 if (!validation.valid) {
 return NextResponse.json({ error: validation.error }, { status: 400 })
 }

 // Initialize S3 service
 const s3Service = getS3Service()

 // Generate unique S3 key
 const s3Key = s3Service.generateKey(context, fileName)

 // Generate presigned URL for upload
 const uploadUrl = await s3Service.getPresignedUrl(s3Key, 'put', {
 expiresIn: 300, // 5 minutes for upload
 contentType: fileType
 })

 // Generate presigned URL for viewing (after upload)
 const viewUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
 expiresIn: 3600 // 1 hour for viewing
 })

 return NextResponse.json({
 uploadUrl,
 viewUrl,
 s3Key,
 expiresIn: 300,
 metadata: {
 fileName,
 fileType,
 fileSize,
 uploadedBy: session.user.id,
 context
 }
 })
 } catch (_error) {
 // console.error('Generate presigned URL error:', _error)
 return NextResponse.json({ 
 error: 'Failed to generate presigned URL',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
})