'use client'

import { useState, useEffect } from 'react'
import { Calculator, AlertCircle, CheckCircle, XCircle, FileText, Save, MessageSquare, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ReconciliationItem {
  id: string
  costCategory: string
  costName: string
  expectedAmount: number
  invoicedAmount: number
  difference: number
  status: 'match' | 'overbilled' | 'underbilled'
  resolutionNotes?: string
  resolvedBy?: {
    fullName: string
    email: string
  }
  resolvedAt?: string
}

interface InvoiceReconciliation {
  id: string
  invoiceNumber: string
  warehouse: {
    id: string
    name: string
    code: string
  }
  billingPeriodStart: string
  billingPeriodEnd: string
  totalAmount: number
  status: string
  reconciliations: ReconciliationItem[]
}

export default function FinanceReconciliationPage() {
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId')
  
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [invoices, setInvoices] = useState<InvoiceReconciliation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ReconciliationItem | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')

  // Fetch warehouses
  useEffect(() => {
    fetchWarehouses()
  }, [])

  // Fetch reconciliation data
  useEffect(() => {
    if (invoiceId) {
      fetchSingleInvoiceReconciliation(invoiceId)
    } else {
      fetchReconciliationData()
    }
  }, [invoiceId, selectedPeriod, selectedWarehouse])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses')
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      const data = await response.json()
      setWarehouses(data)
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const fetchSingleInvoiceReconciliation = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) throw new Error('Failed to fetch invoice')
      
      const data = await response.json()
      const invoice = data.invoice
      
      // Format for reconciliation view
      setInvoices([{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        warehouse: invoice.warehouse,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        reconciliations: invoice.reconciliations || []
      }])
    } catch (error) {
      console.error('Error fetching invoice reconciliation:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReconciliationData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedWarehouse) params.append('warehouseId', selectedWarehouse)
      if (selectedPeriod) {
        // Parse period to get start/end dates
        const [year, month] = selectedPeriod.split('-')
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 16)
        const endDate = new Date(parseInt(year), parseInt(month), 15)
        params.append('startDate', startDate.toISOString())
        params.append('endDate', endDate.toISOString())
      }
      
      const response = await fetch(`/api/invoices?${params}&status=pending,reconciled,disputed`)
      if (!response.ok) throw new Error('Failed to fetch invoices')
      
      const data = await response.json()
      setInvoices(data.invoices)
    } catch (error) {
      console.error('Error fetching reconciliation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const runReconciliation = async () => {
    setProcessing(true)
    try {
      // This would trigger a batch reconciliation process
      const response = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          period: selectedPeriod
        })
      })
      
      if (!response.ok) throw new Error('Failed to run reconciliation')
      
      alert('Reconciliation process completed!')
      await fetchReconciliationData()
    } catch (error) {
      console.error('Error running reconciliation:', error)
      alert('Failed to run reconciliation')
    } finally {
      setProcessing(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedItem || !resolutionNote.trim()) return
    
    try {
      const response = await fetch(`/api/reconciliation/${selectedItem.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionNotes: resolutionNote
        })
      })
      
      if (!response.ok) throw new Error('Failed to add note')
      
      alert('Note added successfully!')
      setNoteModalOpen(false)
      setResolutionNote('')
      setSelectedItem(null)
      
      // Refresh data
      if (invoiceId) {
        await fetchSingleInvoiceReconciliation(invoiceId)
      } else {
        await fetchReconciliationData()
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note')
    }
  }

  const handleCreateDispute = async (invoiceId: string) => {
    if (!confirm('Create a dispute for this invoice?')) return
    
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disputed' })
      })
      
      if (!response.ok) throw new Error('Failed to create dispute')
      
      alert('Dispute created successfully!')
      
      // Refresh data
      if (invoiceId === invoiceId) {
        await fetchSingleInvoiceReconciliation(invoiceId)
      } else {
        await fetchReconciliationData()
      }
    } catch (error) {
      console.error('Error creating dispute:', error)
      alert('Failed to create dispute')
    }
  }

  const calculateTotals = () => {
    const totals = invoices.reduce((acc, inv) => {
      const invTotals = inv.reconciliations.reduce((invAcc, item) => ({
        expectedAmount: invAcc.expectedAmount + item.expectedAmount,
        invoicedAmount: invAcc.invoicedAmount + item.invoicedAmount,
        difference: invAcc.difference + item.difference,
        matched: invAcc.matched + (item.status === 'match' ? 1 : 0),
        total: invAcc.total + 1
      }), { expectedAmount: 0, invoicedAmount: 0, difference: 0, matched: 0, total: 0 })
      
      return {
        expectedAmount: acc.expectedAmount + invTotals.expectedAmount,
        invoicedAmount: acc.invoicedAmount + invTotals.invoicedAmount,
        difference: acc.difference + invTotals.difference,
        matched: acc.matched + invTotals.matched,
        total: acc.total + invTotals.total
      }
    }, { expectedAmount: 0, invoicedAmount: 0, difference: 0, matched: 0, total: 0 })
    
    return {
      ...totals,
      matchRate: totals.total > 0 ? (totals.matched / totals.total) * 100 : 0
    }
  }

  const totals = calculateTotals()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Description */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Invoice Reconciliation</h1>
              <p className="text-muted-foreground">
                Compare expected vs actual charges
              </p>
            </div>
            <div className="flex items-center gap-2">
            {!invoiceId && (
              <>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Periods</option>
                  <option value="2024-01">Jan 16 - Feb 15, 2024</option>
                  <option value="2023-12">Dec 16 - Jan 15, 2024</option>
                  <option value="2023-11">Nov 16 - Dec 15, 2023</option>
                </select>
                <button 
                  onClick={runReconciliation}
                  disabled={processing}
                  className="action-button"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Run Reconciliation
                    </>
                  )}
                </button>
              </>
            )}
            {invoiceId && (
              <Link
                href="/finance/reconciliation"
                className="secondary-button"
              >
                View All Reconciliations
              </Link>
            )}
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <Calculator className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">About This Page:</p>
                <p>Compare warehouse invoices against expected charges based on actual usage. Review line-by-line discrepancies, add resolution notes, and create disputes for billing errors. The system automatically calculates variances between invoiced and expected amounts.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.invoicedAmount)}</p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Total Expected</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.expectedAmount)}</p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Variance</p>
            <p className={`text-2xl font-bold ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(Math.abs(totals.difference))}
            </p>
          </div>
          <div className="dashboard-card">
            <p className="text-sm text-muted-foreground">Match Rate</p>
            <p className="text-2xl font-bold text-green-600">{totals.matchRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Reconciliation Details */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No invoices found for reconciliation</p>
            </div>
          ) : (
            invoices.map((invoice) => {
              const invoiceTotals = invoice.reconciliations.reduce((acc, item) => ({
                expected: acc.expected + item.expectedAmount,
                invoiced: acc.invoiced + item.invoicedAmount,
                difference: acc.difference + item.difference
              }), { expected: 0, invoiced: 0, difference: 0 })
              
              const hasMatch = invoice.reconciliations.every(r => r.status === 'match')
              
              return (
                <div key={invoice.id} className="border rounded-lg overflow-hidden">
                  <div className={`px-6 py-4 ${
                    hasMatch ? 'bg-green-50' : 'bg-amber-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hasMatch ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold">{invoice.warehouse.name}</h3>
                          <p className="text-sm text-gray-600">
                            Invoice #{invoice.invoiceNumber} • 
                            {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Variance</p>
                        <p className={`text-lg font-bold ${
                          invoiceTotals.difference === 0 ? 'text-green-600' : 
                          invoiceTotals.difference > 0 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {formatCurrency(Math.abs(invoiceTotals.difference))}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {invoice.reconciliations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No reconciliation data available</p>
                        <Link
                          href={`/finance/invoices/${invoice.id}`}
                          className="mt-2 text-primary hover:underline"
                        >
                          View Invoice Details
                        </Link>
                      </div>
                    ) : (
                      <>
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-sm text-gray-600">
                              <th className="pb-2">Cost Category</th>
                              <th className="pb-2">Description</th>
                              <th className="pb-2 text-right">Expected</th>
                              <th className="pb-2 text-right">Invoiced</th>
                              <th className="pb-2 text-right">Difference</th>
                              <th className="pb-2 text-center">Status</th>
                              <th className="pb-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {invoice.reconciliations.map((item) => (
                              <tr key={item.id}>
                                <td className="py-2">{item.costCategory}</td>
                                <td className="py-2">{item.costName}</td>
                                <td className="py-2 text-right">{formatCurrency(item.expectedAmount)}</td>
                                <td className="py-2 text-right">{formatCurrency(item.invoicedAmount)}</td>
                                <td className="py-2 text-right">
                                  <span className={item.difference > 0 ? 'text-red-600' : item.difference < 0 ? 'text-green-600' : ''}>
                                    {formatCurrency(Math.abs(item.difference))}
                                  </span>
                                </td>
                                <td className="py-2 text-center">
                                  {item.status === 'match' ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                  ) : item.status === 'overbilled' ? (
                                    <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-amber-600 mx-auto" />
                                  )}
                                </td>
                                <td className="py-2">
                                  {item.resolutionNotes ? (
                                    <div className="text-sm">
                                      <p className="text-gray-700">{item.resolutionNotes}</p>
                                      {item.resolvedBy && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          - {item.resolvedBy.fullName}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedItem(item)
                                        setNoteModalOpen(true)
                                      }}
                                      className="text-xs text-primary hover:underline"
                                    >
                                      Add note
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t">
                            <tr className="font-semibold">
                              <td className="pt-2" colSpan={2}>Total</td>
                              <td className="pt-2 text-right">{formatCurrency(invoiceTotals.expected)}</td>
                              <td className="pt-2 text-right">{formatCurrency(invoiceTotals.invoiced)}</td>
                              <td className="pt-2 text-right">
                                <span className={invoiceTotals.difference > 0 ? 'text-red-600' : invoiceTotals.difference < 0 ? 'text-green-600' : ''}>
                                  {formatCurrency(Math.abs(invoiceTotals.difference))}
                                </span>
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                        
                        <div className="mt-4 flex gap-2 justify-between">
                          <Link
                            href={`/finance/invoices/${invoice.id}`}
                            className="text-primary hover:underline"
                          >
                            View Invoice Details
                          </Link>
                          {invoiceTotals.difference !== 0 && invoice.status !== 'disputed' && (
                            <button 
                              onClick={() => handleCreateDispute(invoice.id)}
                              className="action-button"
                            >
                              Create Dispute
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Note Modal */}
        {noteModalOpen && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">Add Resolution Note</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {selectedItem.costCategory} - {selectedItem.costName}
                </p>
                <p className="text-sm">
                  Difference: <span className={selectedItem.difference > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatCurrency(Math.abs(selectedItem.difference))}
                  </span>
                </p>
              </div>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                placeholder="Enter resolution notes..."
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setNoteModalOpen(false)
                    setResolutionNote('')
                    setSelectedItem(null)
                  }}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!resolutionNote.trim()}
                  className="action-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}