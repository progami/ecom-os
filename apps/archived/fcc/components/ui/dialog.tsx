import * as React from "react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  )
}

interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className = "" }: DialogContentProps) {
  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto ${className}`}>
      {children}
    </div>
  )
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-slate-800">
      {children}
    </div>
  )
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-white">
      {children}
    </h2>
  )
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-400 mt-1">
      {children}
    </p>
  )
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 border-t border-slate-800 flex justify-end ${className || ''}`}>
      {children}
    </div>
  )
}