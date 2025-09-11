'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { UnifiedDatePicker, DateType } from '@/components/reports/unified-date-picker'
import { getReportDateConfig as getDateConfig } from '@/lib/report-date-config'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const REPORT_TYPES = [
  { value: 'BALANCE_SHEET', label: 'Balance Sheet', accept: '.csv,.xlsx,.xls' },
  { value: 'PROFIT_LOSS', label: 'Profit & Loss', accept: '.csv,.xlsx,.xls' },
  { value: 'TRIAL_BALANCE', label: 'Trial Balance', accept: '.csv,.xlsx,.xls' },
  { value: 'CASH_FLOW', label: 'Cash Flow Statement', accept: '.csv,.xlsx,.xls' },
  { value: 'AGED_PAYABLES', label: 'Aged Payables', accept: '.csv,.xlsx,.xls' },
  { value: 'AGED_RECEIVABLES', label: 'Aged Receivables', accept: '.csv,.xlsx,.xls' }
]

export function ImportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedReportType, setSelectedReportType] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(endOfMonth(subMonths(new Date(), 1))) // Default to end of last month
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1))
  })
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // Handle query parameter for preselecting report type
  useEffect(() => {
    const reportType = searchParams.get('type')
    if (reportType && REPORT_TYPES.some(rt => rt.value === reportType)) {
      setSelectedReportType(reportType)
    }
  }, [searchParams])


  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    noClick: false,
    noKeyboard: false
  })

  const handleImport = async () => {
    if (!selectedReportType || !uploadedFile) {
      toast.error('Please select a report type and upload a file')
      return
    }

    // Validate dates based on report type
    const dateConfig = getDateConfig(selectedReportType)
    let periodStart = ''
    let periodEnd = ''

    if (dateConfig?.dateType === 'month') {
      // For Cash Flow - use month
      periodStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
      periodEnd = format(endOfMonth(selectedDate), 'yyyy-MM-dd')
    } else if (dateConfig?.dateType === 'date-range') {
      // For P&L - use date range
      periodStart = format(dateRange.from, 'yyyy-MM-dd')
      periodEnd = format(dateRange.to, 'yyyy-MM-dd')
    } else {
      // For point-in-time reports
      periodStart = format(selectedDate, 'yyyy-MM-dd')
      periodEnd = format(selectedDate, 'yyyy-MM-dd')
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', uploadedFile)
    formData.append('reportType', selectedReportType)
    formData.append('periodStart', periodStart)
    formData.append('periodEnd', periodEnd)

    // Log import attempt for debugging
    console.log('[Import] Starting import:', {
      reportType: selectedReportType,
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      periodStart,
      periodEnd,
      timestamp: new Date().toISOString()
    })

    try {
      const response = await fetch('/api/v1/reports/import', {
        method: 'POST',
        body: formData
      })

      const responseData = await response.json()
      
      if (!response.ok) {
        console.error('[Import] Failed:', {
          status: response.status,
          error: responseData,
          timestamp: new Date().toISOString()
        })
        throw new Error(responseData.message || 'Import failed')
      }

      console.log('[Import] Success:', {
        recordCount: responseData.recordCount,
        importId: responseData.id,
        timestamp: new Date().toISOString()
      })

      toast.success(`Successfully imported ${responseData.recordCount} records`)
      
      // Reset form
      setSelectedReportType('')
      setUploadedFile(null)
      setSelectedDate(endOfMonth(subMonths(new Date(), 1)))
      setDateRange({
        from: startOfMonth(subMonths(new Date(), 1)),
        to: endOfMonth(subMonths(new Date(), 1))
      })
    } catch (error) {
      console.error('[Import] Error:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      toast.error(error instanceof Error ? error.message : 'Failed to import report')
    } finally {
      setUploading(false)
    }
  }

  const renderDateSelector = () => {
    const dateConfig = getDateConfig(selectedReportType)
    if (!dateConfig) return null

    return (
      <UnifiedDatePicker
        dateType={dateConfig.dateType}
        value={dateConfig.dateType === 'date-range' ? dateRange : selectedDate}
        onChange={(value) => {
          if (dateConfig.dateType === 'date-range' && typeof value === 'object' && 'from' in value) {
            setDateRange(value)
          } else if (value instanceof Date) {
            setSelectedDate(value)
          }
        }}
        label={dateConfig.label}
        disabled={uploading}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Report Type
        </label>
        <select
          value={selectedReportType}
          onChange={(e) => setSelectedReportType(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
          disabled={uploading}
        >
          <option value="">Select a report type</option>
          {REPORT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic Date Selector */}
      {selectedReportType && renderDateSelector()}

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Upload File
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragActive ? 'border-brand-blue bg-brand-blue/10' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} disabled={uploading} />
          <div className="flex flex-col items-center">
            {uploadedFile ? (
              <>
                <CheckCircle className="w-12 h-12 text-brand-emerald mb-3 mx-auto" />
                <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-500 mb-3 mx-auto" />
                <p className="text-sm text-gray-300">
                  {isDragActive
                    ? 'Drop the file here...'
                    : 'Drag and drop your file here, or click to select'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: CSV, Excel (.xls, .xlsx)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Import Instructions */}
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-brand-blue">Import Guidelines</h3>
            <ul className="mt-2 text-sm text-gray-300 list-disc list-inside space-y-1">
              <li>Ensure your file matches the expected format for the selected report type</li>
              <li>Date columns should be in YYYY-MM-DD or DD/MM/YYYY format</li>
              <li>Numeric values should not include currency symbols</li>
              <li>The first row should contain column headers</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.push('/reports')}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={!selectedReportType || !uploadedFile || uploading}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            uploading || !selectedReportType || !uploadedFile
              ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
              : 'bg-brand-blue hover:bg-brand-blue/80 text-white'
          }`}
        >
          {uploading ? 'Importing...' : 'Import Report'}
        </button>
      </div>
    </div>
  )
}