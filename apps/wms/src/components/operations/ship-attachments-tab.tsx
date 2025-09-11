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
          if (data.attachments) {
            // Handle object format (category as key)
            if (typeof data.attachments === 'object' && !Array.isArray(data.attachments)) {
              for (const [category, attachment] of Object.entries(data.attachments)) {
                if (attachment && typeof attachment === 'object') {
                  const att = attachment as Record<string, unknown>
                  const parsedAttachment: Attachment = {
                    name: att.fileName || att.name || 'Unknown file',
                    type: att.contentType || att.type || 'application/octet-stream',
                    size: att.size || 0,
                    s3Key: att.s3Key,
                    viewUrl: att.s3Url || att.viewUrl,
                    category
                  }
                  
                  if (category === 'proof_of_pickup') {
                    setProofOfPickup(parsedAttachment)
                  } else {
                    setOtherAttachments(prev => [...prev, parsedAttachment])
                  }
                }
              }
            }
            
            updateParent()
          }
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
            
            if (category === 'proof_of_pickup') {
              setProofOfPickup(attachment)
            } else {
              setOtherAttachments(prev => [...prev, attachment])
            }
            
            updateParent()
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
          
          if (category === 'proof_of_pickup') {
            setProofOfPickup(attachment)
          } else {
            setOtherAttachments(prev => [...prev, attachment])
          }
          
          updateParent()
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

  const updateParent = () => {
    const allAttachments: Attachment[] = []
    if (proofOfPickup) allAttachments.push(proofOfPickup)
    allAttachments.push(...otherAttachments)
    onAttachmentsChange(allAttachments)
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
    updateParent()
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
    
    setOtherAttachments(prev => prev.filter((_, i) => i !== index))
    updateParent()
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
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction Documents
          </h3>
          <p className="text-sm text-gray-600 mt-1">Upload supporting documents (Max 5MB per file)</p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Proof of Pickup */}
        <div className="border rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-medium text-sm flex items-center gap-2">
                Proof of Pickup
                {proofOfPickup && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">BOL, pickup receipt</p>
            </div>
          </div>
          
          {proofOfPickup ? (
            <div className="bg-white p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 truncate">{proofOfPickup.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(proofOfPickup.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <label 
                    htmlFor="proof-of-pickup-replace"
                    className="text-blue-600 hover:text-blue-800 cursor-pointer p-1"
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
                  className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors ${
                    uploading['proof_of_pickup'] ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  {uploading['proof_of_pickup'] ? (
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
        <div className="border rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-medium text-sm">Other Documents</h4>
              <p className="text-xs text-gray-600 mt-0.5">Additional supporting documents</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {otherAttachments.map((attachment, index) => (
              <div key={index} className="bg-white p-3 rounded border border-gray-200">
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
                      htmlFor={`other-replace-${index}`}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer p-1"
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
                  className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors ${
                    isUploadingAny ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  <Plus className="h-5 w-5 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-600 mt-1">Add more documents</p>
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

AttachmentsTab.displayName = 'ShipAttachmentsTab'