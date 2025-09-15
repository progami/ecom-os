'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const items = [
    { href: '/hrms', label: 'Dashboard', icon: '📊' },
    { href: '/hrms/employees', label: 'Employees', icon: '👥' },
    { href: '/hrms/resources', label: 'Resources', icon: '📚' },
    { href: '/hrms/policies', label: 'Policies', icon: '📋' },
  ]

  if (!mounted) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Menu */}
      <nav
        className={`fixed top-0 left-0 h-full w-72 bg-navy-800 z-50 transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-sm">
              HR
            </div>
            <span className="text-xl font-bold text-white">HRMS</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="px-3 py-4">
          <ul className="space-y-1">
            {items.map(item => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                      transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-navy-800
                      ${isActive
                        ? 'bg-teal text-white shadow-md'
                        : 'text-gray-300 hover:text-white hover:bg-navy-700'
                      }
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-navy-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-teal-600"></div>
            <div className="text-sm">
              <div className="font-medium text-white">Admin User</div>
              <div className="text-gray-400 text-xs">admin@hrms.com</div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose()
              // Add logout logic here
            }}
            className="w-full px-4 py-2 bg-navy-700 hover:bg-navy-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal"
          >
            Sign Out
          </button>
        </div>
      </nav>
    </>
  )
}