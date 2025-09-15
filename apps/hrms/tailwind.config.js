/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom brand colors
        navy: {
          DEFAULT: "#002C51",
          50: "#E6EEF4",
          100: "#CCDDE9",
          200: "#99BBD3",
          300: "#6699BD",
          400: "#3377A7",
          500: "#005591",
          600: "#004474",
          700: "#003357",
          800: "#002C51",
          900: "#001629"
        },
        teal: {
          DEFAULT: "#00C2B9",
          50: "#E6FAF9",
          100: "#CCF5F3",
          200: "#99EBE7",
          300: "#66E1DB",
          400: "#33D7CF",
          500: "#00C2B9",
          600: "#009B94",
          700: "#00746F",
          800: "#004D4A",
          900: "#002625"
        },
        slate: {
          DEFAULT: "#6F7B8B",
          50: "#F1F3F5",
          100: "#E3E6EA",
          200: "#C7CDD5",
          300: "#ABB4C0",
          400: "#8F9BAB",
          500: "#6F7B8B",
          600: "#59626F",
          700: "#434A53",
          800: "#2D3137",
          900: "#17191C"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}