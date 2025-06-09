'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Breadcrumb() {
  const pathname = usePathname()
  const paths = pathname.split('/').filter(Boolean)

  // Generate breadcrumb items
  const breadcrumbs = paths.map((path, index) => {
    const href = `/${paths.slice(0, index + 1).join('/')}`
    const name = path
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    return { name, href }
  })

  return (
    <nav className="flex mb-8" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-4">
        <li>
          <div>
            <Link href="/wms" className="text-gray-400 hover:text-gray-500">
              <Home className="h-5 w-5" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.href}>
            <div className="flex items-center">
              <ChevronRight className="h-5 w-5 text-gray-400" />
              {index === breadcrumbs.length - 1 ? (
                <span className="ml-4 text-sm font-medium text-gray-500">
                  {breadcrumb.name}
                </span>
              ) : (
                <Link
                  href={breadcrumb.href}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  {breadcrumb.name}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}