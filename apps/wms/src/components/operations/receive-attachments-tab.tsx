'use client'

// React imports
import { useState, useEffect } from 'react'

// Third-party libraries
import { toast } from 'react-hot-toast'

// Internal components
import { useS3Upload } from '@/hooks/use-s3-upload'

// Icons
import { Upload, FileText, X, Check } from '@/lib/lucide-icons'

interface Attachment {
  name: string
  type: string
  size: number
  s3Key?: string
  viewUrl?: string
  category: string
  file?: File // Add the actual File object
}

interface AttachmentsTabProps {
  transactionId?: string
  onAttachmentsChange: (attachments: Attachment[]) => void
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

const ATTACHMENT_CATEGORIES = [
  {
    id: 'commercial_invoice',
    label: 'Commercial Invoice',
    description: 'Invoice with pricing',
    required: false
  },
  {
    id: 'bill_of_lading',
    label: 'Bill of Lading',
    description: 'Carrier document',
    required: false
  },
  {
    id: 'packing_list',
    label: 'Packing List',
    description: 'Items & quantities',
    required: false
  },
  {
    id: 'delivery_note',
    label: 'Delivery Note',
    description: 'Proof of delivery',
    required: false
  },
  {
    id: 'cube_master',
    label: 'Cube Master',
    description: 'Pallet stacking config',
    required: false
  },
  {
    id: 'transaction_certificate',
    label: 'TC GRS',
    description: 'Goods Receipt Slip',
    required: false
  },
  {
    id: 'custom_declaration',
    label: 'CDS',
    description: 'Customs clearance',
    required: false
  }
]

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

export function AttachmentsTab({ transactionId, onAttachmentsChange }: AttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Record<string, Attachment | null>>({})
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
          if (data.attachments) {
            const existingAttachments: Record<string, Attachment | null> = {}
            
            // Handle object format (category as key)
            if (isAttachmentRecord(data.attachments)) {
              for (const [category, attachmentValue] of Object.entries(data.attachments)) {
                existingAttachments[category] = parseApiAttachment(category, attachmentValue)
              }
            }
            
            setAttachments(existingAttachments)
            onAttachmentsChange(Object.values(existingAttachments).filter(Boolean) as Attachment[])
          }
        })
        .catch(err => console.error('Failed to load existing attachments:', err))
        .finally(() => setLoadingExisting(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name} is too large. Maximum size is 5MB.`)
      return
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
      return
    }

    setUploading(prev => ({ ...prev, [category]: true }))

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
          
          const newAttachments = { ...attachments, [category]: attachment }
          setAttachments(newAttachments)
          onAttachmentsChange(Object.values(newAttachments).filter(Boolean) as Attachment[])
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
        
        const newAttachments = { ...attachments, [category]: attachment }
        setAttachments(newAttachments)
        onAttachmentsChange(Object.values(newAttachments).filter(Boolean) as Attachment[])
        toast.success(`${file.name} selected`)
      }
    } catch (_error) {
      toast.error(`Failed to upload ${file.name}`)
      // console.error('Upload error:', _error)
    } finally {
      setUploading(prev => ({ ...prev, [category]: false }))
    }
    
    // Reset input
    event.target.value = ''
  }

  const removeAttachment = async (category: string) => {
    // If we have a transactionId and the attachment has an s3Key, delete from server
    if (transactionId && attachments[category]?.s3Key) {
      try {
        const response = await fetch(`/api/transactions/${transactionId}/attachments?category=${category}`, {
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
    
    const newAttachments = { ...attachments, [category]: null }
    setAttachments(newAttachments)
    onAttachmentsChange(Object.values(newAttachments).filter(Boolean) as Attachment[])
  }

  const _getCategoryLabel = (categoryId: string): string => {
    const category = ATTACHMENT_CATEGORIES.find(c => c.id === categoryId)
    return category?.label || categoryId
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-6">
      {/* Transaction Documents Section */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction Documents
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {transactionId ? 'Upload or replace supporting documents' : 'Upload supporting documents'} (Max 5MB per file)
          </p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ATTACHMENT_CATEGORIES.map(category => {
          const attachment = attachments[category.id]
          const isUploading = uploading[category.id]
          
          return (
            <div key={category.id} className="border rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    {category.label}
                    {attachment && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">{category.description}</p>
                </div>
              </div>
              
              {attachment ? (
                <div className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate">{attachment.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <label 
                        htmlFor={`${category.id}-replace`}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer p-1"
                        title="Replace file"
                      >
                        <Upload className="h-4 w-4" />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeAttachment(category.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    id={`${category.id}-replace`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => handleFileUpload(e, category.id)}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="upload-container">
                  <label htmlFor={`${category.id}-upload`} className="cursor-pointer block">
                    <div 
                      className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors ${
                        isUploading ? 'opacity-50 cursor-wait' : ''
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
                          <p className="text-xs text-gray-600 mt-2">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-gray-400 mx-auto" />
                          <p className="text-xs text-gray-600 mt-1">Click to upload</p>
                        </>
                      )}
                    </div>
                  </label>
                  <input
                    id={`${category.id}-upload`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => handleFileUpload(e, category.id)}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>
              )}
            </div>
          )
        })}
          </div>
        </div>
      </div>
      
      {Object.keys(uploading).some(key => uploading[key]) && progress.percentage > 0 && (
        <div className="mt-4">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1 text-center">
            Uploading: {progress.percentage}%
          </p>
        </div>
      )}
    </div>
  )
}

AttachmentsTab.displayName = 'ReceiveAttachmentsTab'
