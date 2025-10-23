export declare const brandColors: {
    /** Primary brand background (matches #0B273F reference) */
    readonly primary: "#0B273F";
    /** Slightly richer primary shade for gradients */
    readonly primaryMuted: "#021B2B";
    /** Deepest base tone for overlays */
    readonly primaryDeep: "#011226";
    /** Near-black tone for footer fades */
    readonly primaryOverlay: "#00070F";
    /** Secondary / light surface */
    readonly secondary: "#F5F5F5";
    /** Accent brand cyan */
    readonly accent: "#00C2B9";
    readonly accentHover: "#00AFA8";
    readonly accentShadow: "rgba(0, 194, 185, 0.28)";
    readonly accentShadowHover: "rgba(0, 194, 185, 0.35)";
    /** Supporting dark text colors */
    readonly supportNavy: "#002433";
    readonly supportInk: "#02253B";
    readonly slate: "#6F7B8B";
    readonly white: "#FFFFFF";
};
export type BrandColorToken = keyof typeof brandColors;
export declare const brandFontFamilies: {
    readonly primary: "Montserrat, var(--font-montserrat), system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
};
export type BrandFontToken = keyof typeof brandFontFamilies;
export declare const brandRadii: {
    readonly xl: "32px";
    readonly lg: "18px";
    readonly md: "12px";
    readonly sm: "8px";
};
export type BrandRadiusToken = keyof typeof brandRadii;
