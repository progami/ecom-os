'use client'

/**
 * React context for multi-tenant state management.
 * Provides current tenant info and switching capabilities to the entire app.
 */

import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { TenantCode, TenantConfig, TENANTS, getAllTenants, isValidTenantCode } from './constants'

interface TenantContextValue {
  /** Current active tenant */
  current: TenantConfig
  /** Current tenant code */
  currentCode: TenantCode
  /** All available tenants (user may have access to subset) */
  available: TenantConfig[]
  /** Switch to a different tenant */
  switchTenant: (code: TenantCode) => Promise<void>
  /** Check if user has access to a specific tenant */
  hasAccess: (code: TenantCode) => boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

interface TenantProviderProps {
  children: ReactNode
  /** Initial tenant code (from cookie/server) */
  initialTenant: TenantCode
  /** Tenant codes the user has access to */
  allowedTenants?: TenantCode[]
}

export function TenantProvider({
  children,
  initialTenant,
  allowedTenants,
}: TenantProviderProps) {
  const router = useRouter()

  // Determine available tenants
  const available = useMemo(() => {
    if (allowedTenants && allowedTenants.length > 0) {
      return allowedTenants.map((code) => TENANTS[code])
    }
    return getAllTenants()
  }, [allowedTenants])

  const hasAccess = useCallback(
    (code: TenantCode): boolean => {
      if (!allowedTenants || allowedTenants.length === 0) {
        return true // No restrictions
      }
      return allowedTenants.includes(code)
    },
    [allowedTenants]
  )

  const switchTenant = useCallback(
    async (code: TenantCode) => {
      if (!isValidTenantCode(code)) {
        throw new Error(`Invalid tenant code: ${code}`)
      }

      if (!hasAccess(code)) {
        throw new Error(`Access denied to tenant: ${code}`)
      }

      // Call API to set tenant cookie
      const response = await fetch('/api/tenant/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: code }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to switch tenant')
      }

      // Refresh the page to load new tenant data
      router.refresh()
      // Navigate to dashboard (or current page will reload with new tenant)
      router.push('/dashboard')
    },
    [hasAccess, router]
  )

  const current = TENANTS[initialTenant]

  const value = useMemo<TenantContextValue>(
    () => ({
      current,
      currentCode: initialTenant,
      available,
      switchTenant,
      hasAccess,
    }),
    [current, initialTenant, available, switchTenant, hasAccess]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

/**
 * Hook to access tenant context
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)

  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }

  return context
}

/**
 * Hook to get current tenant code only
 */
export function useTenantCode(): TenantCode {
  const { currentCode } = useTenant()
  return currentCode
}
