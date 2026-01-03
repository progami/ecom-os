'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export function Tooltip({ content, children, position = 'top', delay = 100, className, style }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      setMounted(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollX = window.scrollX
      const scrollY = window.scrollY

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = rect.top + scrollY - 8
          left = rect.left + scrollX + rect.width / 2
          break
        case 'bottom':
          top = rect.bottom + scrollY + 8
          left = rect.left + scrollX + rect.width / 2
          break
        case 'left':
          top = rect.top + scrollY + rect.height / 2
          left = rect.left + scrollX - 8
          break
        case 'right':
          top = rect.top + scrollY + rect.height / 2
          left = rect.right + scrollX + 8
          break
      }

      setCoords({ top, left })
    }
  }, [isVisible, position])

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  const getTransform = () => {
    switch (position) {
      case 'top':
        return 'translate(-50%, -100%)'
      case 'bottom':
        return 'translate(-50%, 0)'
      case 'left':
        return 'translate(-100%, -50%)'
      case 'right':
        return 'translate(0, -50%)'
    }
  }

  const getArrowPosition = () => {
    switch (position) {
      case 'top':
        return 'bottom-[-5px] left-1/2 -translate-x-1/2'
      case 'bottom':
        return 'top-[-5px] left-1/2 -translate-x-1/2'
      case 'left':
        return 'right-[-5px] top-1/2 -translate-y-1/2'
      case 'right':
        return 'left-[-5px] top-1/2 -translate-y-1/2'
    }
  }

  const tooltipContent = isVisible && mounted && createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        transform: getTransform(),
      }}
    >
      <div className="relative max-w-xs whitespace-pre-line rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white shadow-lg dark:border-[#0b3a52] dark:bg-[#0d2a3f] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
        {content}
        <div
          className={`absolute w-2.5 h-2.5 bg-slate-900 dark:bg-[#0d2a3f] border-slate-800 dark:border-[#0b3a52] transform rotate-45 ${getArrowPosition()} ${
            position === 'top' ? 'border-b border-r' :
            position === 'bottom' ? 'border-t border-l' :
            position === 'left' ? 'border-t border-r' :
            'border-b border-l'
          }`}
        />
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <div
        ref={triggerRef}
        className={className ?? 'inline-flex'}
        style={style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {tooltipContent}
    </>
  )
}
