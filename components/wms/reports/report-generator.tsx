'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

interface ReportGeneratorProps {
  reportType: string
  reportName: string
  className?: string
}

export function ReportGenerator({ reportType, reportName, className = '' }: ReportGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const generateReport = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/wms/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          period: currentMonth,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}_${currentMonth}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Failed to generate report')
      }
    } catch (error) {
      console.error('Report generation error:', error)
      alert('Error generating report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generateReport}
      disabled={loading}
      className={`inline-flex items-center text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50 ${className}`}
    >
      <Download className="h-4 w-4 mr-1" />
      {loading ? 'Generating...' : reportName}
    </button>
  )
}