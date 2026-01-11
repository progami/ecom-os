'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Cloud, Loader2, X } from '@/lib/lucide-icons'

type ImportResult = {
  imported: number
  skipped: number
  errors: string[]
}

export function AmazonImportButton({ onImportComplete }: { onImportComplete?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    setResult(null)
    setImporting(false)
  }

  const handleImport = async () => {
    setImporting(true)
    setResult(null)

    try {
      const response = await fetch('/api/amazon/import-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error || payload?.message || 'Failed to import from Amazon'
        throw new Error(message)
      }

      const nextResult = payload?.result as ImportResult | undefined
      if (!nextResult) {
        throw new Error('Unexpected response from Amazon import')
      }

      setResult(nextResult)
      toast.success(`Imported ${nextResult.imported} SKU${nextResult.imported === 1 ? '' : 's'}`)
      onImportComplete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import from Amazon')
      setResult({
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Failed to import from Amazon'],
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline" className="gap-2">
        <Cloud className="h-4 w-4" />
        Import from Amazon
      </Button>

      {isOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] overflow-y-auto">
              <div className="flex min-h-screen items-center justify-center px-4 py-12 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-slate-500/75 transition-opacity" onClick={handleClose} />

                <div className="relative inline-block w-full max-w-lg transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-medium text-slate-900">Import Products from Amazon</h3>
                      <Button
                        onClick={handleClose}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={importing}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">
                        Imports SKUs from your Amazon account (Selling Partner API). Existing SKUs are skipped.
                      </div>

                      {result ? (
                        <div className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="font-medium">Import Results</h4>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                result.errors.length === 0
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {result.errors.length === 0 ? (
                                <>
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Success
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Partial
                                </>
                              )}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">Imported:</span>{' '}
                              <span className="font-medium">{result.imported}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Skipped:</span>{' '}
                              <span className="font-medium">{result.skipped}</span>
                            </div>
                          </div>

                          {result.errors.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-2 text-xs font-medium text-slate-700">Notes</p>
                              <ul className="max-h-32 space-y-1 overflow-auto text-xs text-slate-600">
                                {result.errors.map((error, idx) => (
                                  <li key={`${error}-${idx}`} className="flex gap-2">
                                    <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                    <span>{error}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <Button onClick={handleImport} disabled={importing} className="w-full sm:ml-3 sm:w-auto gap-2">
                      {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {importing ? 'Importing…' : 'Import'}
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="outline"
                      disabled={importing}
                      className="mt-3 w-full sm:mt-0 sm:w-auto"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

