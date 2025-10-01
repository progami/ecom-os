/**
 * X-Plan Theme Color Constants
 * Provides consistent light/dark mode color mappings
 */

export const THEME_COLORS = {
  // Backgrounds
  surface: 'bg-white dark:bg-[#041324]',
  surfaceHover: 'hover:bg-slate-50 dark:hover:bg-[#06182b]',
  surfaceSecondary: 'bg-slate-50 dark:bg-[#06182b]/60',
  surfaceCard: 'bg-white dark:bg-[#06182b]/85',
  surfaceInput: 'bg-white dark:bg-[#061d33]/90',
  surfaceAccent: 'bg-slate-100 dark:bg-[#002C51]/70',
  surfaceSkeletonholder: 'bg-slate-200 dark:bg-[#0c2537]',

  // Borders
  border: 'border-slate-200 dark:border-[#0b3a52]',
  borderLight: 'border-slate-300 dark:border-white/15',
  borderAccent: 'border-cyan-600 dark:border-[#00c2b9]',
  borderMuted: 'border-slate-300 dark:border-[#6F7B8B]/50',
  borderRing: 'ring-slate-200 dark:ring-[#0f2e45]/60',

  // Text
  text: 'text-slate-900 dark:text-white',
  textSecondary: 'text-slate-700 dark:text-slate-200/80',
  textMuted: 'text-slate-600 dark:text-[#6F7B8B]',
  textAccent: 'text-cyan-700 dark:text-[#00C2B9]',
  textHeading: 'text-cyan-700 dark:text-cyan-300/80',

  // Buttons
  buttonPrimary: 'bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-[#00c2b9] dark:text-[#002430] dark:hover:bg-[#00a39e]',
  buttonSecondary: 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-200 dark:border-white/15 dark:hover:bg-white/10',

  // Shadows
  shadow: 'shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]',
  shadowCard: 'shadow-md dark:shadow-[0_16px_40px_rgba(1,12,24,0.45)]',
  shadowButton: 'shadow-md dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]',

  // Ring offsets
  ringOffset: 'ring-offset-white dark:ring-offset-[#041324]',
} as const

/**
 * Hex color mappings for inline styles and SVG
 */
export const HEX_COLORS = {
  light: {
    surface: '#ffffff',
    surfaceSecondary: '#f8fafc',
    border: '#cbd5e1',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    accent: '#0891b2',
  },
  dark: {
    surface: '#041324',
    surfaceSecondary: '#06182b',
    border: '#0b3a52',
    text: '#ffffff',
    textSecondary: '#e2e8f0',
    textMuted: '#6F7B8B',
    accent: '#00c2b9',
  },
} as const
