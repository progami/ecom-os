'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PermissionBadgeProps {
 permission: string
 granted?: boolean
 className?: string
}

export function PermissionBadge({ permission, granted = true, className }: PermissionBadgeProps) {
 const [resource, action] = permission.split(':')
 
 const getResourceColor = (resource: string) => {
 const colors: Record<string, string> = {
 invoice: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
 inventory: 'bg-green-500/10 text-green-700 border-green-500/20',
 warehouse: 'bg-brand-teal-500/10 text-brand-teal-700 border-brand-teal-500/20',
 user: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
 sku: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
 rate: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
 report: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
 settings: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
 audit: 'bg-red-500/10 text-red-700 border-red-500/20',
 transaction: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
 cost: 'bg-brand-teal-500/10 text-brand-teal-700 border-brand-teal-500/20',
 demo: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
 amazon: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
 export: 'bg-lime-500/10 text-lime-700 border-lime-500/20',
 import: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
 }
 return colors[resource] || 'bg-slate-500/10 text-slate-700 border-slate-500/20'
 }

 return (
 <Badge
 variant="outline"
 className={cn(
 'text-xs font-medium',
 granted ? getResourceColor(resource) : 'bg-slate-100 text-slate-400 border-slate-300 line-through',
 className
 )}
 >
 {resource}:{action}
 </Badge>
 )
}