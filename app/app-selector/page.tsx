'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Calculator, Shield, Loader2 } from 'lucide-react'

interface AppConfig {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  path: string
  requiredPermissions: string[]
}

const apps: AppConfig[] = [
  {
    id: 'wms',
    name: 'Warehouse Management',
    description: 'Manage inventory, shipments, and warehouse operations',
    icon: <Building2 className="h-8 w-8" />,
    path: '/wms/dashboard',
    requiredPermissions: ['staff'] // Both admin and staff can access
  },
  {
    id: 'bookkeeping',
    name: 'Bookkeeping',
    description: 'Manage financial records and transactions',
    icon: <Calculator className="h-8 w-8" />,
    path: '/bookkeeping',
    requiredPermissions: ['staff'] // Both admin and staff can access
  },
  {
    id: 'admin',
    name: 'Admin Panel',
    description: 'System administration and user management',
    icon: <Shield className="h-8 w-8" />,
    path: '/admin',
    requiredPermissions: ['admin'] // Only admin can access (for future use)
  }
]

export default function AppSelectorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/auth/login')
  }

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    )
  }

  // Filter apps based on user permissions
  const availableApps = apps.filter(app => 
    app.requiredPermissions.every(permission => 
      session?.user?.permissions?.includes(permission)
    )
  )

  // Auto-redirect if user has access to only one app
  useEffect(() => {
    if (availableApps.length === 1) {
      const timer = setTimeout(() => {
        router.push(availableApps[0].path)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [availableApps, router])

  const handleAppSelect = (path: string) => {
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {session?.user?.name || session?.user?.email}
          </h1>
          <p className="mt-2 text-lg text-gray-600">Select an application</p>
        </div>

        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          data-testid="app-grid"
        >
          {availableApps.map((app) => (
            <Card
              key={app.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              data-testid={`app-card-${app.id}`}
              onClick={() => handleAppSelect(app.path)}
            >
              <CardHeader className="flex flex-col items-center text-center">
                <div className="mb-4 text-blue-600">{app.icon}</div>
                <CardTitle>
                  <button
                    type="button"
                    className="text-xl font-semibold hover:text-blue-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAppSelect(app.path)
                    }}
                  >
                    {app.name}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  {app.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {availableApps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              You don't have access to any applications. Please contact your administrator.
            </p>
          </div>
        )}

        {availableApps.length === 1 && (
          <div className="text-center mt-8">
            <p className="text-gray-500">
              Redirecting to {availableApps[0].name}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}