'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { redirect } from 'next/navigation'
import { useState } from 'react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { 
  Building2, 
  Calculator, 
  Shield, 
  ChevronDown, 
  LogOut,
  Loader2 
} from 'lucide-react'
import Image from 'next/image'

interface AppShellProps {
  children: React.ReactNode
}

interface AppInfo {
  name: string
  path: string
  icon: React.ReactNode
  permissions: string[]
}

const appInfo: Record<string, AppInfo> = {
  '/wms': {
    name: 'Warehouse Management',
    path: '/wms/dashboard',
    icon: <Building2 className="h-4 w-4" />,
    permissions: ['staff'] // Both admin and staff can access
  },
  '/bookkeeping': {
    name: 'Bookkeeping',
    path: '/bookkeeping',
    icon: <Calculator className="h-4 w-4" />,
    permissions: ['staff'] // Both admin and staff can access
  },
  '/admin': {
    name: 'Admin Panel',
    path: '/admin',
    icon: <Shield className="h-4 w-4" />,
    permissions: ['admin'] // Only admin can access (for future use)
  }
}

export default function AppShell({ children }: AppShellProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false)

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/auth/login')
  }

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center" data-testid="loading-spinner">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      </div>
    )
  }

  // Determine current app based on pathname
  const currentAppKey = Object.keys(appInfo).find(key => pathname.startsWith(key))
  const currentApp = currentAppKey ? appInfo[currentAppKey] : null

  // Get available apps based on user permissions
  const availableApps = Object.entries(appInfo).filter(([_, app]) =>
    app.permissions.every(permission => 
      session?.user?.permissions?.includes(permission)
    )
  )

  const handleAppSwitch = (path: string) => {
    router.push(path)
    setIsAppSwitcherOpen(false)
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login' })
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = session?.user?.name || session?.user?.email || ''
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200" role="banner">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and App Name */}
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold">EO</span>
                </div>
                <img 
                  src="/logo.png" 
                  alt="Ecom OS Logo" 
                  className="hidden"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <span className="ml-3 text-xl font-semibold">Ecom OS</span>
              </div>

              {/* App Switcher */}
              {currentApp && (
                <div className="ml-6">
                  <DropdownMenu open={isAppSwitcherOpen} onOpenChange={setIsAppSwitcherOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2"
                        aria-label="Current app"
                      >
                        {currentApp.icon}
                        <span>{currentApp.name}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Switch Application</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableApps.map(([key, app]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleAppSwitch(app.path)}
                          className={currentAppKey === key ? 'bg-blue-50' : ''}
                          role="menuitem"
                        >
                          <div className="flex items-center gap-2">
                            {app.icon}
                            <span>{app.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{session?.user?.name || session?.user?.email}</p>
                  <p className="text-xs text-gray-500">{session?.user?.role}</p>
                </div>
                <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">{getUserInitials()}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen" role="main">
        {children}
      </main>
    </div>
  )
}