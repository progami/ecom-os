'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface ProtectedPageProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRole?: string
  unauthorizedRedirect?: string
  loadingComponent?: React.ReactNode
}

export default function ProtectedPage({
  children,
  requiredPermissions,
  requiredRole,
  unauthorizedRedirect = '/wms/unauthorized',
  loadingComponent
}: ProtectedPageProps) {
  const { data: session, status } = useSession()

  // Show loading state
  if (status === 'loading') {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center" data-testid="loading-spinner">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (status === 'unauthenticated' || !session) {
    redirect('/auth/login')
  }

  // Check role requirement
  if (requiredRole && session.user.role !== requiredRole) {
    redirect(unauthorizedRedirect)
  }

  // Check permission requirements
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      session.user.permissions.includes(permission)
    )

    if (!hasAllPermissions) {
      redirect(unauthorizedRedirect)
    }
  }

  // User is authorized, render children
  return <>{children}</>
}