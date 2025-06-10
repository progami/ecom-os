# Ecom OS Style Guide

## Visual Design System

### Color Palette

#### Brand Colors
```css
/* Primary Gradient */
--gradient-primary: from-purple-500 to-pink-500;

/* Application Themes */
--wms-gradient: from-blue-500 to-cyan-500;
--bookkeeping-gradient: from-emerald-500 to-green-500;
--centraldb-gradient: from-purple-500 to-pink-500;

/* Background Colors */
--bg-primary: rgb(15, 23, 42);      /* slate-900 */
--bg-secondary: rgb(30, 41, 59);    /* slate-800 */
--bg-surface: rgba(30, 41, 59, 0.5); /* slate-800/50 */

/* Text Colors */
--text-primary: rgb(255, 255, 255);   /* white */
--text-secondary: rgb(209, 213, 219); /* gray-300 */
--text-muted: rgb(156, 163, 175);     /* gray-400 */
```

### Typography

#### Font Stack
```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

#### Font Sizes
```css
/* Headings */
--text-4xl: 2.25rem;  /* 36px */
--text-3xl: 1.875rem; /* 30px */
--text-2xl: 1.5rem;   /* 24px */
--text-xl: 1.25rem;   /* 20px */

/* Body */
--text-base: 1rem;    /* 16px */
--text-sm: 0.875rem;  /* 14px */
--text-xs: 0.75rem;   /* 12px */
```

#### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing System

```css
/* Based on Tailwind's spacing scale */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### Border Radius

```css
--radius-sm: 0.125rem;   /* 2px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-3xl: 1.5rem;    /* 24px */
--radius-full: 9999px;
```

## Component Patterns

### Card Component
```tsx
<div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-[1.02]">
  {/* Glow effect */}
  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
  
  {/* Content */}
  <div className="relative z-10">
    {/* Card content */}
  </div>
</div>
```

### Button Styles
```tsx
// Primary Button
<button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all">
  Button Text
</button>

// Secondary Button
<button className="px-6 py-3 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all">
  Button Text
</button>

// Ghost Button
<button className="px-6 py-3 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all">
  Button Text
</button>
```

### Form Inputs
```tsx
<input
  type="text"
  className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
  placeholder="Enter text..."
/>
```

### Navigation Links
```tsx
<Link
  href="/path"
  className="text-gray-400 hover:text-white transition-colors"
>
  Link Text
</Link>
```

## Animation & Transitions

### Standard Transitions
```css
/* Default transition */
transition-all duration-300

/* Hover scale effect */
hover:transform hover:scale-[1.02]

/* Color transitions */
transition-colors duration-200

/* Opacity transitions */
transition-opacity duration-500
```

### Loading States
```tsx
// Spinner
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />

// Pulse
<div className="animate-pulse bg-slate-700 rounded-lg h-4 w-32" />
```

## Layout Patterns

### Container
```tsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

### Grid Layouts
```tsx
// 3-column grid (responsive)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Grid items */}
</div>

// 2-column grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Grid items */}
</div>
```

### Flex Layouts
```tsx
// Centered content
<div className="flex items-center justify-center min-h-screen">
  {/* Content */}
</div>

// Space between
<div className="flex items-center justify-between">
  {/* Items */}
</div>
```

## Dark Theme Guidelines

### Background Hierarchy
1. **Base Background:** `bg-slate-900`
2. **Elevated Surface:** `bg-slate-800/50`
3. **Higher Elevation:** `bg-slate-700/50`
4. **Highest Elevation:** `bg-slate-600/50`

### Border Colors
- Default: `border-slate-700/50` or `border-white/10`
- Hover: `border-white/20`
- Focus: `border-purple-400`

### Text Hierarchy
1. **Primary:** `text-white`
2. **Secondary:** `text-gray-300`
3. **Muted:** `text-gray-400`
4. **Disabled:** `text-gray-500`

## Iconography

### Icon Sizes
```tsx
// Small: 16px
<Icon className="w-4 h-4" />

// Medium: 20px
<Icon className="w-5 h-5" />

// Large: 24px
<Icon className="w-6 h-6" />

// Extra Large: 32px
<Icon className="w-8 h-8" />
```

### Icon Colors
- Match text color for inline icons
- Use gradient colors for feature icons
- White for icons on colored backgrounds

## Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile Considerations
- Stack elements vertically on mobile
- Increase touch targets to 44px minimum
- Simplify navigation for mobile
- Hide non-essential elements

## Accessibility

### Focus States
```css
focus:outline-none 
focus:ring-2 
focus:ring-purple-500 
focus:ring-offset-2 
focus:ring-offset-slate-800
```

### ARIA Labels
```tsx
<button aria-label="Close dialog">
  <X className="w-5 h-5" />
</button>
```

### Color Contrast
- Ensure 4.5:1 contrast ratio for normal text
- Ensure 3:1 contrast ratio for large text
- Test with color blindness simulators

## Code Style Conventions

### Component Structure
```tsx
// 1. Imports
import { useState } from 'react'
import { ComponentProps } from './types'

// 2. Types/Interfaces
interface Props {
  title: string
  variant?: 'primary' | 'secondary'
}

// 3. Component
export function Component({ title, variant = 'primary' }: Props) {
  // 4. State
  const [isOpen, setIsOpen] = useState(false)
  
  // 5. Effects
  useEffect(() => {
    // Effect logic
  }, [])
  
  // 6. Handlers
  const handleClick = () => {
    setIsOpen(!isOpen)
  }
  
  // 7. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}
```

### Naming Conventions
- **Components:** PascalCase (e.g., `UserProfile`)
- **Functions:** camelCase (e.g., `getUserData`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_ITEMS`)
- **Files:** kebab-case (e.g., `user-profile.tsx`)

### Import Order
1. React/Next.js imports
2. Third-party libraries
3. Internal imports (components, utils, types)
4. Styles/CSS imports

## Performance Guidelines

### Image Optimization
```tsx
import Image from 'next/image'

<Image
  src="/image.jpg"
  alt="Description"
  width={400}
  height={300}
  loading="lazy"
/>
```

### Code Splitting
```tsx
// Dynamic imports for heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />
})
```

### Memoization
```tsx
// Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])

// Memoize callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependency])
```