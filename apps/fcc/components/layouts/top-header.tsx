'use client'

import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/layouts/app-layout'

export function TopHeader() {
  const { isCollapsed } = useSidebar()
  
  return (
    <header className={cn(
      "fixed top-0 right-0 z-50 h-16 bg-slate-900 border-b border-slate-800",
      "flex items-center justify-between px-4 lg:px-6",
      "transition-all duration-300",
      // Adjust left margin based on sidebar state
      "left-0 lg:left-64",
      isCollapsed && "lg:left-20"
    )}>
      {/* Left side - empty for now */}
      <div className="flex items-center gap-4">
        {/* On mobile, leave space for the menu button */}
        <div className="w-14 lg:w-0" />
      </div>
      
      {/* Right side - empty for now */}
      <div className="flex items-center gap-4">
        {/* Space for future items like notifications, user menu, etc. */}
      </div>
    </header>
  )
}