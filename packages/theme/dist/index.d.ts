export declare const brandColors: {
    /** Main brand navy */
    readonly main: "#002C51";
    /** Secondary brand teal/cyan */
    readonly secondary: "#00C2B9";
    /** Accent muted gray */
    readonly accent: "#6F7B8B";
    /** White */
    readonly white: "#FFFFFF";
    /** Navy color scale */
    readonly navy: {
        readonly 50: "#e6f0f9";
        readonly 100: "#cce0f3";
        readonly 200: "#99c2e6";
        readonly 300: "#66a3da";
        readonly 400: "#3385cd";
        readonly 500: "#0066c1";
        readonly 600: "#00528a";
        readonly 700: "#003d68";
        readonly 800: "#002C51";
        readonly 900: "#001f3a";
        readonly 950: "#001423";
    };
    /** Teal color scale */
    readonly teal: {
        readonly 50: "#e6faf9";
        readonly 100: "#ccf5f3";
        readonly 200: "#99ebe7";
        readonly 300: "#66e1db";
        readonly 400: "#33d7cf";
        readonly 500: "#00C2B9";
        readonly 600: "#00a89f";
        readonly 700: "#008d86";
        readonly 800: "#00726c";
        readonly 900: "#005753";
        readonly 950: "#003c3a";
    };
    /** Gray color scale */
    readonly gray: {
        readonly 50: "#f7f8f9";
        readonly 100: "#eef0f2";
        readonly 200: "#dde1e5";
        readonly 300: "#ccd1d8";
        readonly 400: "#bbc2cb";
        readonly 500: "#aab3be";
        readonly 600: "#99a4b1";
        readonly 700: "#8894a4";
        readonly 800: "#778597";
        readonly 900: "#6F7B8B";
        readonly 950: "#5a6372";
    };
    /** Legacy aliases for backward compatibility */
    readonly primary: "#002C51";
    readonly primaryMuted: "#021B2B";
    readonly primaryDeep: "#011226";
    readonly primaryOverlay: "#00070F";
    readonly accentHover: "#00AFA8";
    readonly accentShadow: "rgba(0, 194, 185, 0.28)";
    readonly accentShadowHover: "rgba(0, 194, 185, 0.35)";
    readonly supportNavy: "#002433";
    readonly supportInk: "#02253B";
    readonly slate: "#6F7B8B";
};
export type BrandColorToken = keyof typeof brandColors;
export declare const brandFontFamilies: {
    /** Primary sans-serif font */
    readonly primary: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    /** Monospace font for code */
    readonly mono: "JetBrains Mono, Monaco, Consolas, monospace";
};
export type BrandFontToken = keyof typeof brandFontFamilies;
export declare const brandRadii: {
    readonly xl: "32px";
    readonly lg: "18px";
    readonly md: "12px";
    readonly sm: "8px";
};
export type BrandRadiusToken = keyof typeof brandRadii;
/** Semantic colors for UI feedback */
export declare const semanticColors: {
    readonly success: {
        readonly 50: "#f0fdf4";
        readonly 100: "#dcfce7";
        readonly 200: "#bbf7d0";
        readonly 300: "#86efac";
        readonly 400: "#4ade80";
        readonly 500: "#22c55e";
        readonly 600: "#16a34a";
        readonly 700: "#15803d";
        readonly 800: "#166534";
        readonly 900: "#14532d";
    };
    readonly warning: {
        readonly 50: "#fffbeb";
        readonly 100: "#fef3c7";
        readonly 200: "#fde68a";
        readonly 300: "#fcd34d";
        readonly 400: "#fbbf24";
        readonly 500: "#f59e0b";
        readonly 600: "#d97706";
        readonly 700: "#b45309";
        readonly 800: "#92400e";
        readonly 900: "#78350f";
    };
    readonly danger: {
        readonly 50: "#fef2f2";
        readonly 100: "#fee2e2";
        readonly 200: "#fecaca";
        readonly 300: "#fca5a5";
        readonly 400: "#f87171";
        readonly 500: "#ef4444";
        readonly 600: "#dc2626";
        readonly 700: "#b91c1c";
        readonly 800: "#991b1b";
        readonly 900: "#7f1d1d";
    };
};
