'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, Info } from '@/lib/lucide-icons'

interface TooltipProps {
  content: string
  children?: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  icon?: 'help' | 'info'
  iconSize?: 'sm' | 'md' | 'lg'
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  icon = 'help',
  iconSize = 'sm'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollX = window.scrollX || window.pageXOffset
      const scrollY = window.scrollY || window.pageYOffset
      
      let top = 0
      let left = 0
      
      switch (position) {
        case 'top':
          top = rect.top + scrollY - 8 // 8px gap
          left = rect.left + scrollX + rect.width / 2
          break
        case 'bottom':
          top = rect.bottom + scrollY + 8 // 8px gap
          left = rect.left + scrollX + rect.width / 2
          break
        case 'left':
          top = rect.top + scrollY + rect.height / 2
          left = rect.left + scrollX - 8 // 8px gap
          break
        case 'right':
          top = rect.top + scrollY + rect.height / 2
          left = rect.right + scrollX + 8 // 8px gap
          break
      }
      
      setTooltipPosition({ top, left })
    }
  }, [isVisible, position])

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  const Icon = icon === 'help' ? HelpCircle : Info

  const tooltipContent = isVisible && mounted && (
    createPortal(
      <div 
        className="fixed z-[9999] pointer-events-none"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: position === 'top' ? 'translate(-50%, -100%)' :
                     position === 'bottom' ? 'translate(-50%, 0)' :
                     position === 'left' ? 'translate(-100%, -50%)' :
                     'translate(0, -50%)'
        }}
      >
        <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-xs whitespace-pre-line">
          {content}
          <div 
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      </div>,
      document.body
    )
  )

  return (
    <>
      <div 
        ref={triggerRef}
        className="relative inline-flex items-center"
      >
        <div
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          className="cursor-help"
        >
          {children || (
            <Icon className={`${sizeClasses[iconSize]} text-gray-400 hover:text-gray-600`} />
          )}
        </div>
      </div>
      {tooltipContent}
    </>
  )
}

// Quick helper for inline tooltips
interface InlineTooltipProps {
  label: string
  tooltip: string
  required?: boolean
}

export function InlineTooltip({ label, tooltip, required }: InlineTooltipProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <Tooltip content={tooltip} iconSize="sm" />
    </div>
  )
}