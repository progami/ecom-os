'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

export function Breadcrumb() {
  const pathname = usePathname()
  
  // Don't show breadcrumbs on home or login pages
  if (pathname === '/' || pathname === '/auth/login') {
    return null
  }

  // Parse the pathname into segments
  const segments = pathname.split('/').filter(Boolean)
  
  // Create breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    return { href, label }
  })

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      <Link
        href="/"
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.href} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              href={breadcrumb.href}
              className="hover:text-gray-900 transition-colors"
            >
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}