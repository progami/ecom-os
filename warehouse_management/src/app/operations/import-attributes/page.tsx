'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Download,
  Package,
  Calendar,
  Truck,
  X,
  Eye
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'react-hot-toast'

interface Transaction {
  id: string
  transactionId: string
  transactionDate: string
  transactionType: string
  warehouse: { name: string }
  sku: { skuCode: string; description: string }
  batchLot: string
  referenceId: string
  shipName?: string
  containerNumber?: string
  attachments?: any
}

interface MissingAttribute {
  transactionId: string
  missingFields: string[]
  transaction: Transaction
}

export default function ImportAttributesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [additionalAttributes, setAdditionalAttributes] = useState<any>({})
  const [filter, setFilter] = useState<'all' | 'missing' | 'complete'>('missing')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transactions?includeAttachments=true&limit=500')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const requiredFields = [
    'packingList',
    'commercialInvoice',
    'deliveryNote',
    'cubemaster',
    'customsDeclaration',
    'billOfLading',
    'qualityCertificate',
    'fumigationCertificate'
  ]

  const getMissingFields = (transaction: Transaction): string[] => {
    const missing: string[] = []
    const attachments = transaction.attachments || {}
    
    // Check for required documents based on transaction type
    if (transaction.transactionType === 'RECEIVE') {
      if (!attachments.packingList) missing.push('Packing List')
      if (!attachments.commercialInvoice) missing.push('Commercial Invoice')
      if (!attachments.deliveryNote) missing.push('Delivery Note')
      if (!attachments.cubemaster) missing.push('Cube Master Stacking Style')
    }
    
    if (transaction.transactionType === 'SHIP') {
      if (!attachments.packingList) missing.push('Packing List')
      if (!attachments.deliveryNote) missing.push('Delivery Note')
    }

    // Check for additional attributes
    if (!transaction.shipName && transaction.transactionType === 'RECEIVE') {
      missing.push('Ship Name')
    }
    if (!transaction.containerNumber && transaction.transactionType === 'RECEIVE') {
      missing.push('Container Number')
    }

    return missing
  }

  const filteredTransactions = transactions.filter(t => {
    const missing = getMissingFields(t)
    if (filter === 'missing') return missing.length > 0
    if (filter === 'complete') return missing.length === 0
    return true
  })

  const handleFileUpload = async () => {
    if (!selectedTransaction || !file || !uploadType) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', uploadType)
    formData.append('transactionId', selectedTransaction.id)

    try {
      const response = await fetch(`/api/transactions/${selectedTransaction.id}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('Document uploaded successfully')
        setShowUploadModal(false)
        setFile(null)
        setUploadType('')
        fetchTransactions()
      } else {
        toast.error('Failed to upload document')
      }
    } catch (error) {
      toast.error('Failed to upload document')
    }
  }

  const handleAttributeUpdate = async () => {
    if (!selectedTransaction) return

    try {
      const response = await fetch(`/api/transactions/${selectedTransaction.id}/attributes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(additionalAttributes)
      })

      if (response.ok) {
        toast.success('Attributes updated successfully')
        setSelectedTransaction(null)
        setAdditionalAttributes({})
        fetchTransactions()
      } else {
        toast.error('Failed to update attributes')
      }
    } catch (error) {
      toast.error('Failed to update attributes')
    }
  }

  if (loading || status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const missingCount = transactions.filter(t => getMissingFields(t).length > 0).length
  const completeCount = transactions.filter(t => getMissingFields(t).length === 0).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Import Transaction Attributes"
          subtitle="Add missing documents and attributes to transactions"
          description="Upload missing documents and add required attributes to complete transaction records. This ensures full traceability and compliance."
          icon={Upload}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          textColor="text-blue-800"
          actions={
            <button
              className="secondary-button"
              onClick={() => window.open('/api/export/missing-attributes', '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Missing List
            </button>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Attributes</p>
                <p className="text-2xl font-bold text-orange-600">{missingCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-400" />
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Complete</p>
                <p className="text-2xl font-bold text-green-600">{completeCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilter('missing')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'missing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Missing Attributes ({missingCount})
            </button>
            <button
              onClick={() => setFilter('complete')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'complete'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Complete ({completeCount})
            </button>
          </nav>
        </div>

        {/* Transactions Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Missing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => {
                const missing = getMissingFields(transaction)
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(transaction.transactionDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                      {transaction.transactionId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        transaction.transactionType === 'RECEIVE' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.warehouse.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.sku.skuCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.batchLot}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {missing.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {missing.slice(0, 2).map((field, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {field}
                            </span>
                          ))}
                          {missing.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              +{missing.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction)
                            setShowUploadModal(true)
                          }}
                          className="text-primary hover:text-primary-dark"
                          title="Upload Document"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction)
                            setAdditionalAttributes({
                              shipName: transaction.shipName || '',
                              containerNumber: transaction.containerNumber || ''
                            })
                          }}
                          className="text-primary hover:text-primary-dark"
                          title="Edit Attributes"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            // View transaction details
                            router.push(`/operations/transactions/${transaction.id}`)
                          }}
                          className="text-gray-600 hover:text-gray-800"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <EmptyState
                      icon={filter === 'complete' ? CheckCircle : AlertCircle}
                      title={filter === 'complete' ? "All transactions complete" : "No transactions found"}
                      description={filter === 'complete' 
                        ? "All transactions have the required documents and attributes."
                        : "No transactions match the selected filter."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setFile(null)
                  setUploadType('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select document type</option>
                  <option value="packingList">Packing List</option>
                  <option value="commercialInvoice">Commercial Invoice</option>
                  <option value="deliveryNote">Delivery Note</option>
                  <option value="cubemaster">Cube Master Stacking Style</option>
                  <option value="customsDeclaration">Customs Declaration</option>
                  <option value="billOfLading">Bill of Lading</option>
                  <option value="qualityCertificate">Quality Certificate</option>
                  <option value="fumigationCertificate">Fumigation Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Select File</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setFile(null)
                    setUploadType('')
                  }}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!file || !uploadType}
                  className="primary-button"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attributes Modal */}
      {selectedTransaction && !showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Transaction Attributes</h3>
              <button
                onClick={() => {
                  setSelectedTransaction(null)
                  setAdditionalAttributes({})
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ship Name</label>
                <input
                  type="text"
                  value={additionalAttributes.shipName || ''}
                  onChange={(e) => setAdditionalAttributes({
                    ...additionalAttributes,
                    shipName: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter ship name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Container Number</label>
                <input
                  type="text"
                  value={additionalAttributes.containerNumber || ''}
                  onChange={(e) => setAdditionalAttributes({
                    ...additionalAttributes,
                    containerNumber: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter container number"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setSelectedTransaction(null)
                    setAdditionalAttributes({})
                  }}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAttributeUpdate}
                  className="primary-button"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}