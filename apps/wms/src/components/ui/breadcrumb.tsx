'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from '@/lib/lucide-icons'
import { getRelativeUrl } from '@/lib/utils/url'

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
    const defaultPath = '/' + segments.slice(0, index + 1).join('/')

    let targetPath: string | null = defaultPath

    if (segment === 'operations') {
      const next = segments[index + 1]
      const operationsDefaults: Record<string, string> = {
        'purchase-orders': '/operations/purchase-orders',
        'inventory': '/operations/inventory',
        'receive': '/operations/receive',
        'ship': '/operations/ship',
        'pallet-variance': '/operations/pallet-variance',
      }
      const fallback = '/operations/purchase-orders'
      const target = (next && operationsDefaults[next]) || fallback
      targetPath = getRelativeUrl(target)
    } else {
      targetPath = getRelativeUrl(defaultPath)
    }

    const href = targetPath
    
    // Handle special cases for better labels
    let label = segment
    switch (segment) {
      case 'operations':
        label = 'Operations'
        break
      case 'finance':
        label = 'Finance'
        break
      case 'config':
        label = 'Configuration'
        break
      case 'admin':
        label = 'Admin'
        break
      case 'integrations':
        label = 'Integrations'
        break
      case 'transactions':
        label = 'Transactions'
        break
      case 'inventory':
        label = 'Inventory Ledger'
        break
      default:
        // For IDs and other segments, format them nicely
        if (segment.match(/^[a-f0-9-]+$/i) && segment.length > 20) {
          // Looks like an ID, truncate it
          label = segment.substring(0, 8) + '...'
        } else {
          label = segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }
    }
    
    return { href, label }
  })

  // Determine home link based on user role
  const homeLink = getRelativeUrl('/dashboard')

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
      <Link
        href={homeLink}
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((breadcrumb, index) => (
        <div key={`${breadcrumb.label}-${index}`} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">
              {breadcrumb.label}
            </span>
          ) : (
            breadcrumb.href ? (
              <Link
                href={breadcrumb.href}
                className="hover:text-foreground transition-colors"
              >
                {breadcrumb.label}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {breadcrumb.label}
              </span>
            )
          )}
        </div>
      ))}
    </nav>
  )
}
