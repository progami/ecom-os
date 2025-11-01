/**
 * X-Plan Theme Color Constants
 * Provides consistent color mappings for light mode
 */

export const THEME_COLORS = {
  // Backgrounds
  surface: 'bg-white',
  surfaceHover: 'hover:bg-slate-50',
  surfaceSecondary: 'bg-slate-50/60',
  surfaceCard: 'bg-white/85',
  surfaceInput: 'bg-white/90',
  surfaceAccent: 'bg-slate-100/70',
  surfaceSkeletonholder: 'bg-slate-200',

  // Borders
  border: 'border-slate-200',
  borderLight: 'border-slate-300',
  borderAccent: 'border-cyan-600',
  borderMuted: 'border-slate-300/50',
  borderRing: 'ring-slate-200/60',

  // Text
  text: 'text-slate-900',
  textSecondary: 'text-slate-700',
  textMuted: 'text-slate-600',
  textAccent: 'text-cyan-700',
  textHeading: 'text-cyan-700',

  // Buttons
  buttonPrimary: 'bg-cyan-600 text-white hover:bg-cyan-700',
  buttonSecondary: 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50',

  // Shadows
  shadow: 'shadow-lg',
  shadowCard: 'shadow-md',
  shadowButton: 'shadow-md',

  // Ring offsets
  ringOffset: 'ring-offset-white',
} as const

/**
 * Hex color mappings for inline styles and SVG
 */
export const HEX_COLORS = {
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  border: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  accent: '#0891b2',
} as const
