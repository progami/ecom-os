/**
 * Import History Component Usage Examples
 * 
 * This file demonstrates how to integrate the ImportHistory component
 * into different report pages with various configurations.
 */

import { useState } from 'react'
import { ImportHistory } from './ImportHistory'
import { toast } from 'sonner'

// Example 1: Basic Usage in Trial Balance Report
export function TrialBalanceImportExample() {
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  
  const handleSelectImport = (importId: string) => {
    setSelectedImportId(importId)
    // Load data from the selected import
    toast.success(`Loading data from import ${importId}`)
    // Fetch and display the imported data
  }
  
  const handleDeleteImport = async (importId: string) => {
    try {
      const response = await fetch(`/api/v1/reports/import-history?id=${importId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete import')
      }
      
      toast.success('Import deleted successfully')
    } catch (error) {
      toast.error('Failed to delete import')
      throw error
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Data Source Toggle */}
      <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
        <span className="text-sm text-gray-400">Data Source:</span>
        <div className="flex gap-2">
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedImportId 
                ? 'bg-brand-blue text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
            onClick={() => setSelectedImportId(null)}
          >
            Live Xero Data
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedImportId 
                ? 'bg-brand-blue text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Imported Data
          </button>
        </div>
      </div>
      
      {/* Import History */}
      <ImportHistory
        reportType="TRIAL_BALANCE"
        onSelectImport={handleSelectImport}
        onDeleteImport={handleDeleteImport}
        maxItems={5}
      />
    </div>
  )
}

// Example 2: Cash Flow with Import Comparison
export function CashFlowImportExample() {
  const [compareMode, setCompareMode] = useState(false)
  
  const handleCompareImports = (importIds: string[]) => {
    setCompareMode(true)
    // Navigate to comparison view or open modal
    toast.info(`Comparing ${importIds.length} imports`)
  }
  
  return (
    <ImportHistory
      reportType="CASH_FLOW"
      onSelectImport={(id) => console.log('Selected:', id)}
      onCompareImports={handleCompareImports}
      showActions={true}
    />
  )
}

// Example 3: All Reports View with Filtering
export function AllReportsImportExample() {
  const handleSelectImport = (importId: string) => {
    // Navigate to the appropriate report with the import data
    window.location.href = `/reports?importId=${importId}`
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">All Import History</h1>
      
      <ImportHistory
        // No reportType specified - shows all types
        onSelectImport={handleSelectImport}
        maxItems={20}
        className="max-w-6xl"
      />
    </div>
  )
}

// Example 4: Integration with Report Page State
export function IntegratedReportExample() {
  const [dataSource, setDataSource] = useState<'live' | 'imported'>('live')
  const [importId, setImportId] = useState<string | null>(null)
  const [showImportHistory, setShowImportHistory] = useState(false)
  
  const loadImportedData = async (importId: string) => {
    setImportId(importId)
    setDataSource('imported')
    setShowImportHistory(false)
    
    // Fetch the imported data
    try {
      const response = await fetch(`/api/v1/reports/data?importId=${importId}`)
      const data = await response.json()
      // Update your report state with the imported data
    } catch (error) {
      toast.error('Failed to load imported data')
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header with Data Source Toggle */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Balance Sheet</h1>
        
        <div className="flex items-center gap-4">
          {/* Data Source Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
            <span className="text-sm text-gray-400">Source:</span>
            <span className="text-sm font-medium text-gray-200">
              {dataSource === 'live' ? 'Live Xero' : `Import ${importId?.slice(-6)}`}
            </span>
          </div>
          
          {/* Toggle Import History */}
          <button
            onClick={() => setShowImportHistory(!showImportHistory)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showImportHistory ? 'Hide' : 'Show'} Import History
          </button>
        </div>
      </div>
      
      {/* Import History Panel */}
      {showImportHistory && (
        <div className="mb-6 p-6 bg-secondary rounded-xl border border-default">
          <ImportHistory
            reportType="BALANCE_SHEET"
            onSelectImport={loadImportedData}
            maxItems={5}
          />
        </div>
      )}
      
      {/* Main Report Content */}
      <div className="bg-secondary rounded-xl p-6">
        {/* Your report content here */}
      </div>
    </div>
  )
}

// Example 5: Report Page Hook for Import Management
export function useImportManagement(reportType: string) {
  const [dataSource, setDataSource] = useState<'live' | 'imported'>('live')
  const [importId, setImportId] = useState<string | null>(null)
  const [importData, setImportData] = useState<any>(null)
  
  const loadFromImport = async (importId: string) => {
    try {
      const response = await fetch(`/api/v1/reports/data?importId=${importId}`)
      if (!response.ok) throw new Error('Failed to load import')
      
      const data = await response.json()
      setImportData(data)
      setImportId(importId)
      setDataSource('imported')
      
      return data
    } catch (error) {
      toast.error('Failed to load imported data')
      throw error
    }
  }
  
  const switchToLive = () => {
    setDataSource('live')
    setImportId(null)
    setImportData(null)
  }
  
  return {
    dataSource,
    importId,
    importData,
    loadFromImport,
    switchToLive,
    isImported: dataSource === 'imported'
  }
}