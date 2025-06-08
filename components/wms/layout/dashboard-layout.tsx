'use client'

import { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Home, Package, Package2, TruckIcon, FileText, Settings, 
  ChevronDown, LogOut, User, BarChart3, AlertCircle 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/wms', icon: Home },
  { name: 'Inventory', href: '/wms/inventory', icon: Package },
  { name: 'Products', href: '/wms/products', icon: Package2 },
  { name: 'Warehouses', href: '/wms/warehouses', icon: TruckIcon },
  { name: 'Operations', href: '/wms/operations', icon: FileText },
  { name: 'Reports', href: '/wms/reports', icon: BarChart3 },
  { name: 'Settings', href: '/wms/settings', icon: Settings },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session) {
    router.push('/api/auth/signin')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/wms" className="flex items-center space-x-2">
                <Package className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">WMS</span>
              </Link>
            </div>
            
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <User className="h-5 w-5" />
                <span>{session.user.name || session.user.email}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                  <Link
                    href="/wms/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/wms/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Settings
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={() => router.push('/api/auth/signout')}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 inline mr-2" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm border-r">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-2">
                {navigation.map((item) => {
                  const isActive = typeof window !== 'undefined' && window.location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'mr-3 h-5 w-5',
                          isActive ? 'text-white' : 'text-gray-400'
                        )}
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            
            {/* User info at bottom */}
            <div className="border-t p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <User className="h-8 w-8 rounded-full bg-gray-200 p-1" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">
                    {session.user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session.user.role || 'Staff'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}