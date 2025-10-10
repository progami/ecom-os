export const brandColors = {
  /** Primary brand background (matches #0B273F reference) */
  primary: '#0B273F',
  /** Slightly richer primary shade for gradients */
  primaryMuted: '#021B2B',
  /** Deepest base tone for overlays */
  primaryDeep: '#011226',
  /** Near-black tone for footer fades */
  primaryOverlay: '#00070F',
  /** Secondary / light surface */
  secondary: '#F5F5F5',
  /** Accent brand cyan */
  accent: '#00C2B9',
  accentHover: '#00AFA8',
  accentShadow: 'rgba(0, 194, 185, 0.28)',
  accentShadowHover: 'rgba(0, 194, 185, 0.35)',
  /** Supporting dark text colors */
  supportNavy: '#002433',
  supportInk: '#02253B',
  slate: '#6F7B8B',
  white: '#FFFFFF',
} as const;

export type BrandColorToken = keyof typeof brandColors;

export const brandFontFamilies = {
  primary: 'Montserrat, var(--font-montserrat), system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
} as const;

export type BrandFontToken = keyof typeof brandFontFamilies;

export const brandRadii = {
  xl: '32px',
  lg: '18px',
  md: '12px',
  sm: '8px',
} as const;

export type BrandRadiusToken = keyof typeof brandRadii;
