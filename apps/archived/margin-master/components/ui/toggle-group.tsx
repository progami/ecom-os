'use client'

import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

const ToggleGroupContext = React.createContext<{
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline'
}>({
  size: 'default',
  variant: 'default',
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
    size?: 'default' | 'sm' | 'lg'
    variant?: 'default' | 'outline'
  }
>(({ className, variant = 'default', size = 'default', children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center justify-center gap-1', className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    variant?: 'default' | 'outline'
    size?: 'default' | 'sm' | 'lg'
  }
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  const finalSize = context.size || size || 'default'
  const finalVariant = context.variant || variant || 'default'

  const sizeClasses = {
    default: 'h-10 px-3',
    sm: 'h-8 px-2 text-xs',
    lg: 'h-11 px-5',
  }

  const variantClasses = {
    default: 'data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
    outline: 'border border-input bg-transparent data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
  }

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[finalSize],
        variantClasses[finalVariant],
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }