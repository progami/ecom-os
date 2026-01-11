'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface PortalModalProps {
  open: boolean
  children: React.ReactNode
  className?: string
}

export function PortalModal({ open, children, className }: PortalModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[120] flex justify-center bg-black/50 p-4 backdrop-blur-sm',
        className
      )}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body
  )
}
