'use client'

import { useSession } from 'next-auth/react'
import { hasWarehouseAccess } from '@/lib/wms/utils/auth-utils'

/**
 * Hook to check if the current user has access to a specific warehouse
 */
export function useWarehouseAccess(warehouseId: string | undefined) {
  const { data: session } = useSession()
  
  if (!warehouseId) return false
  
  return hasWarehouseAccess(session, warehouseId)
}

/**
 * Hook to get the user's warehouse filter for queries
 */
export function useWarehouseFilter(requestedWarehouseId?: string) {
  const { data: session } = useSession()
  
  if (!session) return null
  
  // Staff users are restricted to their warehouse
  if (session.user.role === 'staff') {
    if (!session.user.warehouseId) return null
    return { warehouseId: session.user.warehouseId }
  }
  
  // Admin users can access specific warehouse if requested
  if (session.user.role === 'admin' && requestedWarehouseId) {
    return { warehouseId: requestedWarehouseId }
  }
  
  // Admin users without specific warehouse get all
  return {}
}