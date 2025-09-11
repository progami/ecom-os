import { Session } from 'next-auth';

/**
 * Check if a user has access to a specific warehouse
 * @param session - The user session
 * @param warehouseId - The warehouse ID to check access for
 * @returns true if user has access, false otherwise
 */
export function hasWarehouseAccess(session: Session | null, warehouseId: string): boolean {
  if (!session) return false;
  
  // Admin users have access to all warehouses
  if (session.user.role === 'admin') return true;
  
  // Staff users only have access to their assigned warehouse
  if (session.user.role === 'staff') {
    return session.user.warehouseId === warehouseId;
  }
  
  return false;
}

/**
 * Get the warehouse filter for database queries based on user role
 * @param session - The user session
 * @param requestedWarehouseId - Optional warehouse ID from request
 * @returns Warehouse filter object for Prisma queries
 */
export function getWarehouseFilter(
  session: Session | null, 
  requestedWarehouseId?: string
): { warehouseId?: string } | null {
  if (!session) return null;
  
  // Staff users are restricted to their warehouse
  if (session.user.role === 'staff') {
    if (!session.user.warehouseId) return null;
    return { warehouseId: session.user.warehouseId };
  }
  
  // Admin users can access specific warehouse if requested
  if (session.user.role === 'admin' && requestedWarehouseId) {
    return { warehouseId: requestedWarehouseId };
  }
  
  // Admin users without specific warehouse get all
  return {};
}

/**
 * Validate invoice access for a user
 * @param session - The user session
 * @param invoice - The invoice object with warehouseId
 * @returns true if user can access the invoice
 */
export function canAccessInvoice(
  session: Session | null, 
  invoice: { warehouseId: string }
): boolean {
  return hasWarehouseAccess(session, invoice.warehouseId);
}