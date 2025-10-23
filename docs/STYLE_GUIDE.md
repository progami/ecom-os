# Ecom OS Style Guide

## Visual Design System

### Brand Tokens

All brand colors, fonts, and radii live in `@ecom-os/theme`. Import from the package (or via the `tailwind.config.ts` aliases) instead of pasting literal hex values so the palette stays consistent across apps.

```ts
import { brandColors, brandFontFamilies, brandRadii } from "@ecom-os/theme"
```

#### Color Palette

| Token            | Hex      | Tailwind Class           | Usage                                    |
|------------------|----------|--------------------------|------------------------------------------|
| `primary`        | `#0B273F`| `bg-brand-primary`       | Primary backgrounds                      |
| `primaryMuted`   | `#021B2B`| `bg-brand-primaryMuted`  | Gradient mid tones                       |
| `primaryDeep`    | `#011226`| `bg-brand-primaryDeep`   | Gradient transitions                     |
| `primaryOverlay` | `#00070F`| `bg-brand-primaryOverlay`| Footer fades / overlays                  |
| `secondary`      | `#F5F5F5`| `bg-brand-secondary`     | Light surfaces / cards                   |
| `accent`         | `#00C2B9`| `bg-brand-accent`        | Primary CTA fills                        |
| `supportNavy`    | `#002433`| `text-brand-supportNavy` | Accent text on cyan backgrounds          |
| `supportInk`     | `#02253B`| `text-brand-supportInk`  | Header typography                        |
| `slate`          | `#6F7B8B`| `text-brand-slate`       | Secondary text                           |
| `white`          | `#FFFFFF`| `text-brand-white`       | Neutral copy                             |

To apply transparency, use Tailwind’s slash notation (`bg-brand-cyan/20`) or pull the RGBA helpers exported alongside the brand palette (`brandColors.cyanShadow`).

#### Typography

- Primary family: `brandFontFamilies.primary` (Montserrat). The font is already wired through `app/layout.tsx`; Tailwind exposes it as `font-brand`.
- Default text color on brand backgrounds is `text-white`; accent copy should use `text-brand-slate` for muted states or `text-brand-cyan` for emphasis.

#### CTA Geometry

- Rounded corners use `brandRadii.lg` (18px) for asymmetric CTAs. Tailwind classes can reference the built-in CSS variable by applying `rounded-tl-[18px]` until a dedicated utility is introduced.

#### Tailwind Helpers

`tailwind.config.ts` extends the theme with the brand palette and fonts, so prefer utilities such as `bg-brand-primary`, `text-brand-accent`, and `font-brand` over inline hex codes.

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
