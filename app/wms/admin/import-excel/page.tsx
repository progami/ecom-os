'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle,
  Info,
  Download,
  RefreshCw
} from 'lucide-react'
import { DashboardLayout } from '@/components/wms/layout/dashboard-layout'
import { PageHeader } from '@/components/wms/ui/page-header'
import { toast } from 'react-hot-toast'

interface ImportResult {
  sheet: string
  imported: number
  skipped: number
  errors: string[]
}

export default function ImportExcelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([
    'sku master',
    'warehouse config',
    'cost master',
    'inventory ledger'
  ])

  const availableSheets = [
    { value: 'sku master', label: 'SKU Master', description: 'Product definitions and dimensions' },
    { value: 'warehouse config', label: 'Warehouse Config', description: 'Pallet configurations per warehouse' },
    { value: 'cost master', label: 'Cost Master', description: 'Cost rates for each warehouse' },
    { value: 'inventory ledger', label: 'Inventory Ledger', description: 'Historical inventory transactions' }
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
          selectedFile.type !== 'application/vnd.ms-excel') {
        toast.error('Please select a valid Excel file')
        return
      }
      setFile(selectedFile)
      setResults([])
    }
  }

  const handleImport = async () => {
    if (!file || selectedSheets.length === 0) {
      toast.error('Please select a file and at least one sheet to import')
      return
    }

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sheets', JSON.stringify(selectedSheets))

    try {
      const response = await fetch('/api/v1/wms/admin/import-excel', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.results)
        toast.success('Import completed successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Import failed')
      }
    } catch (error) {
      toast.error('Failed to import Excel file')
    } finally {
      setImporting(false)
    }
  }

  const handleSheetToggle = (sheet: string) => {
    setSelectedSheets(prev => 
      prev.includes(sheet) 
        ? prev.filter(s => s !== sheet)
        : [...prev, sheet]
    )
  }

  if (session?.user.role !== 'admin') {
    router.push('/wms')
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Import Excel Data"
          subtitle="Import master data from Excel spreadsheet"
          description="Upload the warehouse management Excel file to import SKUs, warehouse configurations, cost rates, and historical transactions. The system will extract available fields and show what additional data needs to be added."
          icon={FileSpreadsheet}
          iconColor="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-800"
          actions={
            <a
              href="/api/v1/wms/admin/export-template"
              className="secondary-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </a>
          }
        />

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-medium text-blue-900">Import Instructions</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• The Excel file should contain sheets: helper, sku master, warehouse config, cost master, inventory ledger</li>
                <li>• SKU Master: Product codes, descriptions, dimensions, units per carton</li>
                <li>• Warehouse Config: Cartons per pallet configurations for storage and shipping</li>
                <li>• Cost Master: Warehouse-specific cost rates by category</li>
                <li>• Inventory Ledger: Historical transactions with dates, quantities, and references</li>
                <li>• Missing fields like ship names and container numbers can be added later via Import Attributes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Select Excel File</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Upload File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-white
                  hover:file:bg-primary-dark
                  file:cursor-pointer"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Sheets to Import
              </label>
              <div className="space-y-2">
                {availableSheets.map(sheet => (
                  <label key={sheet.value} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet.value)}
                      onChange={() => handleSheetToggle(sheet.value)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{sheet.label}</p>
                      <p className="text-sm text-gray-600">{sheet.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={!file || selectedSheets.length === 0 || importing}
              className="primary-button"
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Selected Sheets
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Results */}
        {results.length > 0 && (
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Import Results</h3>
            
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{result.sheet}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.errors.length === 0 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.errors.length === 0 ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Partial Success
                        </>
                      )}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Imported:</span>
                      <span className="ml-2 font-medium text-green-600">{result.imported}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Skipped:</span>
                      <span className="ml-2 font-medium text-yellow-600">{result.skipped}</span>
                    </div>
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded text-sm">
                      <p className="font-medium text-red-900 mb-1">Errors:</p>
                      <ul className="text-red-800 space-y-1">
                        {result.errors.slice(0, 5).map((error, errorIdx) => (
                          <li key={errorIdx} className="text-xs">• {error}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li className="text-xs">• ...and {result.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Next Steps:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Review imported data in their respective modules</li>
                <li>• Use <a href="/wms/operations/import-attributes" className="text-primary hover:underline">Import Attributes</a> to add missing transaction details</li>
                <li>• Configure any additional warehouse settings as needed</li>
                <li>• Begin recording new transactions through the system</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}