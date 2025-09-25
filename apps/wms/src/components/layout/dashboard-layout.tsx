import { MainNav } from './main-nav'
import { Breadcrumb } from '@/components/ui/breadcrumb'

interface DashboardLayoutProps {
  children: React.ReactNode
  hideBreadcrumb?: boolean
  customBreadcrumb?: React.ReactNode
}

export function DashboardLayout({ children, hideBreadcrumb = false, customBreadcrumb }: DashboardLayoutProps) {
  // Use Next.js injected version from package.json
  const version = process.env.NEXT_PUBLIC_VERSION || '0.7.0'
  const releaseTag = `wms-${version}`
  const releaseUrl = `https://github.com/progami/ecom-os/releases/tag/${releaseTag}`
  
  return (
    <>
      <MainNav />
      <div className="md:pl-16 lg:pl-64 transition-all duration-300 h-screen flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 md:px-8 py-4">
            {hideBreadcrumb ? customBreadcrumb ?? null : customBreadcrumb ?? <Breadcrumb />}
          </div>
          <div className="flex-1 px-4 sm:px-6 md:px-8 pb-4 min-h-0">
            {children}
          </div>
        </main>
        <footer className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="px-4 sm:px-6 md:px-8 py-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              WMS{' '}
              <a 
                href={releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 dark:hover:text-blue-400 underline"
              >
                v{version}
              </a>
              {' '}• © 2025 Warehouse Management System
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
