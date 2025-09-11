'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, AlertCircle } from 'lucide-react'

interface BankStatementEntry {
  date: Date
  description: string
  category: string
  amount: number
  runningBalance: number
}

interface BankStatementUploadProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (entries: BankStatementEntry[]) => void
}

export function BankStatementUpload({ isOpen, onClose, onUpload }: BankStatementUploadProps) {
  const [csvData, setCsvData] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<BankStatementEntry[]>([])

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setCsvData('')
      setError('')
      setPreview([])
    }
  }, [isOpen])

  const parseCSV = (text: string) => {
    setError('')
    const lines = text.trim().split('\n')
    
    if (lines.length < 2) {
      setError('Please paste your bank statement data with headers')
      return
    }

    try {
      const entries: BankStatementEntry[] = []
      
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Parse tab-separated values
        const parts = line.split('\t')
        if (parts.length < 5) {
          setError(`Line ${i + 1} doesn't have enough columns. Expected: Date, Description, Category, Amount, Running Balance`)
          return
        }
        
        const [dateStr, description, category, amountStr, balanceStr] = parts
        
        // Parse date
        const dateParts = dateStr.match(/(\w+)\s+(\d+)\s+(\d+)/)
        if (!dateParts) {
          setError(`Invalid date format on line ${i + 1}: ${dateStr}`)
          return
        }
        
        const monthMap: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        }
        
        const month = monthMap[dateParts[1]]
        const day = parseInt(dateParts[2])
        const year = parseInt(dateParts[3])
        
        if (month === undefined || isNaN(day) || isNaN(year)) {
          setError(`Invalid date on line ${i + 1}: ${dateStr}`)
          return
        }
        
        const date = new Date(year, month, day)
        
        // Parse amount and balance
        const amount = parseFloat(amountStr.replace(/,/g, ''))
        const runningBalance = parseFloat(balanceStr.replace(/,/g, ''))
        
        if (isNaN(amount) || isNaN(runningBalance)) {
          setError(`Invalid amount or balance on line ${i + 1}`)
          return
        }
        
        entries.push({
          date,
          description: description.trim(),
          category: category.trim(),
          amount,
          runningBalance
        })
      }
      
      setPreview(entries)
    } catch (err) {
      setError('Failed to parse data. Please check the format.')
    }
  }

  const handleUpload = () => {
    if (preview.length > 0) {
      onUpload(preview)
      setCsvData('')
      setPreview([])
      onClose()
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Bank Statement</DialogTitle>
          <DialogDescription>
            Paste your bank statement data in the format: Date → Description → Category → Amount → Running Balance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> The last date in your upload will become the cutoff date. 
              All recurring expenses will start from the day after this date.
            </AlertDescription>
          </Alert>

          <div>
            <label className="text-sm font-medium">Paste Bank Statement Data</label>
            <Textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="Date	Description	Category	Amount	Running Balance
Apr 21 2025	Zelle from Azhar Munir (Owner Investment)	Equity	1274.06	1274.06
Apr 25 2025	Wire Fee	Bank Fees	-15	1259.06"
              className="h-48 font-mono text-xs"
            />
            <Button 
              onClick={() => parseCSV(csvData)} 
              className="mt-2"
              disabled={!csvData.trim()}
            >
              Parse Data
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Preview ({preview.length} entries)</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((entry, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{formatDate(entry.date)}</td>
                        <td className="p-2">{entry.description}</td>
                        <td className="p-2">{entry.category}</td>
                        <td className="p-2 text-right">{entry.amount.toFixed(2)}</td>
                        <td className="p-2 text-right">{entry.runningBalance.toFixed(2)}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={5} className="p-2 text-center text-gray-500">
                          ... and {preview.length - 10} more entries
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Last entry date: {formatDate(preview[preview.length - 1].date)} 
                (recurring expenses will start after this date)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUpload} disabled={preview.length === 0}>
            <Upload className="h-4 w-4 mr-2" />
            Upload {preview.length} Entries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}