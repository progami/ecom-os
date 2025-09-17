export type AppCode = 'wms' | 'hrms' | 'fcc' | 'website' | 'margin-master'

export type UserRecord = {
  id: string
  email: string
  name?: string | null
  role?: string | null // legacy/global role if available
}

export type AppEntitlement = {
  role: string
  depts?: string[]
}

export type RolesClaim = Record<string, AppEntitlement>

// Simple example policy: map a user's global role to per-app entitlements.
// Replace with DB-backed entitlements and admin UI later.
export function getUserEntitlements(user: UserRecord): RolesClaim {
  const isAdmin = (user.role || '').toLowerCase() === 'admin'
  const roles: RolesClaim = {}

  if (isAdmin) {
    roles['wms'] = { role: 'admin', depts: ['Ops'] }
    roles['fcc'] = { role: 'admin', depts: ['Finance'] }
    roles['hrms'] = { role: 'admin', depts: ['HR / Admin'] }
    roles['margin-master'] = { role: 'admin', depts: ['Product'] }
    roles['legal-suite'] = { role: 'admin', depts: ['Legal'] }
  } else {
    // Default staff with minimal departments; tune per business rules
    roles['wms'] = { role: 'staff', depts: ['Ops'] }
    roles['fcc'] = { role: 'viewer', depts: ['Finance'] }
    roles['margin-master'] = { role: 'viewer', depts: ['Product'] }
    // hrms optional
  }

  return roles
}
