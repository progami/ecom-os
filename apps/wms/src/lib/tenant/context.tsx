'use client'

/**
 * React context for multi-tenant state management.
 * Provides current tenant info to the entire app.
 * Note: Region switching is only allowed from the WorldMap (landing page).
 */

import { createContext, useContext, useMemo, ReactNode } from 'react'
import { TenantCode, TenantConfig, TENANTS } from './constants'

interface TenantContextValue {
  /** Current active tenant */
  current: TenantConfig
  /** Current tenant code */
  currentCode: TenantCode
}

const TenantContext = createContext<TenantContextValue | null>(null)

interface TenantProviderProps {
  children: ReactNode
  /** Initial tenant code (from cookie/server) */
  initialTenant: TenantCode
}

export function TenantProvider({
  children,
  initialTenant,
}: TenantProviderProps) {
  const current = TENANTS[initialTenant]

  const value = useMemo<TenantContextValue>(
    () => ({
      current,
      currentCode: initialTenant,
    }),
    [current, initialTenant]
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
