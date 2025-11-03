'use client'

// React imports
import { useState, useEffect } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Internal components
import { useS3Upload } from '@/hooks/use-s3-upload'

// Icons
import { Upload, FileText, X, Check, Plus } from '@/lib/lucide-icons'

interface Attachment {
 name: string
 type: string
 size: number
 s3Key?: string
 viewUrl?: string
 category: string
 file?: File
}

interface ApiAttachment {
 fileName?: string
 name?: string
 contentType?: string
 type?: string
 size?: number
 s3Key?: string
 s3Url?: string
 viewUrl?: string
}

const isAttachmentRecord = (value: unknown): value is Record<string, unknown> => {
 return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const parseApiAttachment = (category: string, value: unknown): Attachment | null => {
 if (!value || typeof value !== 'object') {
 return null
 }

 const raw = value as ApiAttachment
 const name = typeof raw.fileName === 'string'
 ? raw.fileName
 : typeof raw.name === 'string'
 ? raw.name
 : 'Unknown file'

 const type = typeof raw.contentType === 'string'
 ? raw.contentType
 : typeof raw.type === 'string'
 ? raw.type
 : 'application/octet-stream'

 const size = typeof raw.size === 'number' ? raw.size : 0

 return {
 name,
 type,
 size,
 s3Key: typeof raw.s3Key === 'string' ? raw.s3Key : undefined,
 viewUrl:
 typeof raw.s3Url === 'string'
 ? raw.s3Url
 : typeof raw.viewUrl === 'string'
 ? raw.viewUrl
 : undefined,
 category,
 }
}

interface AttachmentsTabProps {
 transactionId?: string
 onAttachmentsChange: (attachments: Attachment[]) => void
}

export function AttachmentsTab({ transactionId, onAttachmentsChange }: AttachmentsTabProps) {
 const [proofOfPickup, setProofOfPickup] = useState<Attachment | null>(null)
 const [otherAttachments, setOtherAttachments] = useState<Attachment[]>([])
 const [uploading, setUploading] = useState<Record<string, boolean>>({})
 const [_loadingExisting, setLoadingExisting] = useState(false)
 const { uploadToS3: _uploadToS3, progress } = useS3Upload()

 // Load existing attachments when we have a transactionId
 useEffect(() => {
 if (transactionId) {
 setLoadingExisting(true)
 fetch(`/api/transactions/${transactionId}/attachments`)
 .then(res => res.json())
 .then(data => {
 if (!data.attachments || !isAttachmentRecord(data.attachments)) {
 setProofOfPickup(null)
 setOtherAttachments([])
 onAttachmentsChange([])
 return
 }

 let proof: Attachment | null = null
 const extras: Attachment[] = []

 for (const [category, attachmentValue] of Object.entries(data.attachments)) {
 const parsed = parseApiAttachment(category, attachmentValue)
 if (!parsed) {
 continue
 }
 if (category === 'proof_of_pickup') {
 proof = parsed
 } else {
 extras.push(parsed)
 }
 }

 setProofOfPickup(proof)
 setOtherAttachments(extras)
 const all = [...(proof ? [proof] : []), ...extras]
 onAttachmentsChange(all)
 })
 .catch(err => console.error('Failed to load existing attachments:', err))
 .finally(() => setLoadingExisting(false))
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [transactionId])

 const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
 const files = event.target.files
 if (!files || files.length === 0) return

 // For proof of pickup, only allow single file
 if (category === 'proof_of_pickup' && files.length > 1) {
 toast.error('Only one proof of pickup file allowed')
 return
 }

 const filesToProcess = Array.from(files)
 
 for (const file of filesToProcess) {
 // Validate file size (5MB max)
 if (file.size > 5 * 1024 * 1024) {
 toast.error(`${file.name} is too large. Maximum size is 5MB.`)
 continue
 }

 // Validate file type
 const allowedTypes = [
 'application/pdf',
 'image/jpeg',
 'image/png',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ]
 
 if (!allowedTypes.includes(file.type)) {
 toast.error(`${file.name}: Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX`)
 continue
 }

 const uploadKey = category === 'proof_of_pickup' ? 'proof_of_pickup' : `other_${Date.now()}`
 setUploading(prev => ({ ...prev, [uploadKey]: true }))

 try {
 // If we have a transactionId, upload to S3 immediately
 if (transactionId) {
 // Upload via the attachment API endpoint which handles both S3 and database
 const formData = new FormData()
 formData.append('file', file)
 formData.append('documentType', category)
 
 const uploadResponse = await fetch(`/api/transactions/${transactionId}/attachments`, {
 method: 'POST',
 body: formData,
 credentials: 'include'
 })
 
 if (uploadResponse.ok) {
 const attachment: Attachment = {
 name: file.name,
 type: file.type,
 size: file.size,
 category
 }
 
 // Reload attachments to get the S3 info
 const reloadResponse = await fetch(`/api/transactions/${transactionId}/attachments`)
 if (reloadResponse.ok) {
 const data = await reloadResponse.json()
 if (data.attachments && data.attachments[category]) {
 const uploadedAttachment = data.attachments[category]
 attachment.s3Key = uploadedAttachment.s3Key
 attachment.viewUrl = uploadedAttachment.s3Url || uploadedAttachment.viewUrl
 }
 }
 
 const nextProof = category === 'proof_of_pickup' ? attachment : proofOfPickup
 const nextOthers = category === 'proof_of_pickup'
 ? otherAttachments
 : [...otherAttachments, attachment]
 setProofOfPickup(nextProof)
 setOtherAttachments(nextOthers)
 const combined = [...(nextProof ? [nextProof] : []), ...nextOthers]
 onAttachmentsChange(combined)
 toast.success(`${file.name} uploaded successfully`)
 } else {
 throw new Error('Upload failed')
 }
 } else {
 // If no transactionId yet, store file data locally
 const attachment: Attachment = {
 name: file.name,
 type: file.type,
 size: file.size,
 category,
 file: file // Store the actual File object
 }
 
 const nextProof = category === 'proof_of_pickup' ? attachment : proofOfPickup
 const nextOthers = category === 'proof_of_pickup'
 ? otherAttachments
 : [...otherAttachments, attachment]
 setProofOfPickup(nextProof)
 setOtherAttachments(nextOthers)
 const combined = [...(nextProof ? [nextProof] : []), ...nextOthers]
 onAttachmentsChange(combined)
 toast.success(`${file.name} selected`)
 }
 } catch (_error) {
 toast.error(`Failed to upload ${file.name}`)
 // console.error('Upload error:', _error)
 } finally {
 setUploading(prev => ({ ...prev, [uploadKey]: false }))
 }
 }
 
 // Reset input
 event.target.value = ''
 }

 const removeProofOfPickup = async () => {
 // If we have a transactionId and the attachment has an s3Key, delete from server
 if (transactionId && proofOfPickup?.s3Key) {
 try {
 const response = await fetch(`/api/transactions/${transactionId}/attachments?category=proof_of_pickup`, {
 method: 'DELETE',
 credentials: 'include'
 })
 
 if (!response.ok) {
 throw new Error('Failed to delete attachment')
 }
 
 toast.success('Attachment deleted successfully')
 } catch (_error) {
 toast.error('Failed to delete attachment')
 // console.error('Delete error:', _error)
 return
 }
 }
 
 setProofOfPickup(null)
 onAttachmentsChange([...otherAttachments])
 }

 const removeOtherAttachment = async (index: number) => {
 const attachment = otherAttachments[index]
 
 // If we have a transactionId and the attachment has an s3Key, delete from server
 if (transactionId && attachment?.s3Key) {
 try {
 const response = await fetch(`/api/transactions/${transactionId}/attachments?category=${attachment.category}`, {
 method: 'DELETE',
 credentials: 'include'
 })
 
 if (!response.ok) {
 throw new Error('Failed to delete attachment')
 }
 
 toast.success('Attachment deleted successfully')
 } catch (_error) {
 toast.error('Failed to delete attachment')
 // console.error('Delete error:', _error)
 return
 }
 }
 
 const updated = otherAttachments.filter((_, i) => i !== index)
 setOtherAttachments(updated)
 const combined = [...(proofOfPickup ? [proofOfPickup] : []), ...updated]
 onAttachmentsChange(combined)
 }

 const formatFileSize = (bytes: number): string => {
 if (bytes < 1024) return bytes + ' B'
 if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
 return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
 }

 const isUploadingAny = Object.values(uploading).some(v => v)

 return (
 <div className="space-y-6">
 {/* Transaction Documents Section */}
 <div className="bg-white rounded-xl border">
 <div className="px-6 py-4 border-b bg-slate-50">
 <h3 className="text-lg font-semibold flex items-center gap-2">
 <FileText className="h-5 w-5" />
 Transaction Documents
 </h3>
 <p className="text-sm text-slate-600 mt-1">Upload supporting documents (Max 5MB per file)</p>
 </div>
 
 <div className="p-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Proof of Pickup */}
 <div className="border rounded-lg p-4 bg-slate-50 hover:shadow-soft transition-shadow">
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <h4 className="font-medium text-sm flex items-center gap-2">
 Proof of Pickup
 {proofOfPickup && (
 <Check className="h-4 w-4 text-green-600" />
 )}
 </h4>
 <p className="text-xs text-slate-600 mt-0.5">BOL, pickup receipt</p>
 </div>
 </div>
 
 {proofOfPickup ? (
 <div className="bg-white p-3 rounded border border-slate-200">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
 <div className="min-w-0 flex-1">
 <p className="text-sm text-slate-700 truncate">{proofOfPickup.name}</p>
 <p className="text-xs text-slate-500">{formatFileSize(proofOfPickup.size)}</p>
 </div>
 </div>
 <div className="flex items-center gap-1 ml-2">
 <label 
 htmlFor="proof-of-pickup-replace"
 className="text-cyan-600 hover:text-cyan-800 cursor-pointer p-1"
 title="Replace file"
 >
 <Upload className="h-4 w-4" />
 </label>
 <button
 type="button"
 onClick={removeProofOfPickup}
 className="text-red-600 hover:text-red-800 p-1"
 title="Delete file"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 <input
 id="proof-of-pickup-replace"
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
 onChange={(e) => handleFileUpload(e, 'proof_of_pickup')}
 className="hidden"
 />
 </div>
 ) : (
 <div className="upload-container">
 <label htmlFor="proof-of-pickup-upload" className="cursor-pointer block">
 <div 
 className={`border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors ${
 uploading['proof_of_pickup'] ? 'opacity-50 cursor-wait' : ''
 }`}
 >
 {uploading['proof_of_pickup'] ? (
 <>
 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
 <p className="text-xs text-slate-600 mt-2">Uploading...</p>
 </>
 ) : (
 <>
 <Upload className="h-5 w-5 text-slate-400 mx-auto" />
 <p className="text-xs text-slate-600 mt-1">Click to upload</p>
 </>
 )}
 </div>
 </label>
 <input
 id="proof-of-pickup-upload"
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
 onChange={(e) => handleFileUpload(e, 'proof_of_pickup')}
 className="hidden"
 disabled={uploading['proof_of_pickup']}
 />
 </div>
 )}
 </div>

 {/* Other Attachments */}
 <div className="border rounded-lg p-4 bg-slate-50 hover:shadow-soft transition-shadow">
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <h4 className="font-medium text-sm">Other Documents</h4>
 <p className="text-xs text-slate-600 mt-0.5">Additional supporting documents</p>
 </div>
 </div>
 
 <div className="space-y-2">
 {otherAttachments.map((attachment, index) => (
 <div key={index} className="bg-white p-3 rounded border border-slate-200">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
 <div className="min-w-0 flex-1">
 <p className="text-sm text-slate-700 truncate">{attachment.name}</p>
 <p className="text-xs text-slate-500">{formatFileSize(attachment.size)}</p>
 </div>
 </div>
 <div className="flex items-center gap-1 ml-2">
 <label 
 htmlFor={`other-replace-${index}`}
 className="text-cyan-600 hover:text-cyan-800 cursor-pointer p-1"
 title="Replace file"
 >
 <Upload className="h-4 w-4" />
 </label>
 <button
 type="button"
 onClick={() => removeOtherAttachment(index)}
 className="text-red-600 hover:text-red-800 p-1"
 title="Delete file"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 <input
 id={`other-replace-${index}`}
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
 onChange={(e) => {
 // Remove the old attachment first
 removeOtherAttachment(index).then(() => {
 handleFileUpload(e, attachment.category || 'other')
 })
 }}
 className="hidden"
 />
 </div>
 ))}
 
 <div className="upload-container">
 <label htmlFor="other-documents-upload" className="cursor-pointer block">
 <div 
 className={`border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors ${
 isUploadingAny ? 'opacity-50 cursor-wait' : ''
 }`}
 >
 <Plus className="h-5 w-5 text-slate-400 mx-auto" />
 <p className="text-xs text-slate-600 mt-1">Add more documents</p>
 </div>
 </label>
 <input
 id="other-documents-upload"
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
 onChange={(e) => handleFileUpload(e, 'other')}
 className="hidden"
 multiple
 disabled={isUploadingAny}
 />
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 
 {isUploadingAny && progress.percentage > 0 && (
 <div className="mt-4">
 <div className="bg-slate-200 rounded-full h-2">
 <div 
 className="bg-primary h-2 rounded-full transition-all duration-300"
 style={{ width: `${progress.percentage}%` }}
 />
 </div>
 <p className="text-xs text-slate-600 mt-1 text-center">
 Uploading: {progress.percentage}%
 </p>
 </div>
 )}
 </div>
 )
}

AttachmentsTab.displayName = 'ShipAttachmentsTab'
