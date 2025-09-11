'use client'

import { useRef } from 'react'
import { Upload, Download, Rows2 } from 'lucide-react'

export default function TableToolbar({
  onImport,
  onExport,
  showDensityToggle = true,
}: {
  onImport?: (file: File) => void | Promise<void>
  onExport?: () => void | Promise<void>
  showDensityToggle?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleDensity = () => {
    try {
      const current = (localStorage.getItem('hrmsDensity') as 'compact' | 'comfortable' | null) || 'compact'
      const next = current === 'compact' ? 'comfortable' : 'compact'
      localStorage.setItem('hrmsDensity', next)
      window.dispatchEvent(new CustomEvent('hrms:density', { detail: next }))
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 py-2">
      {onImport && (
        <>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2">
            <Upload size={16} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f && onImport) onImport(f)
            e.currentTarget.value = ''
          }} />
        </>
      )}
      {onExport && (
        <button onClick={() => onExport()} className="px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2">
          <Download size={16} /> Export CSV
        </button>
      )}
      {showDensityToggle && (
        <button onClick={toggleDensity} className="ml-auto px-3 py-1.5 text-sm border border-slate-700 rounded bg-slate-900 hover:bg-slate-800 flex items-center gap-2" title="Toggle table density">
          <Rows2 size={16} /> Density
        </button>
      )}
    </div>
  )}

