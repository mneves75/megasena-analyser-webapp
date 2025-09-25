import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./docs/**/*.{md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e9ff",
          200: "#b6d3ff",
          300: "#90bcff",
          400: "#6aa5ff",
          500: "#2f7bff",
          600: "#1f5fe6",
          700: "#184ab8",
          800: "#123789",
          900: "#0c255b",
        },
        surface: {
          DEFAULT: "#fafafc",
          dark: "#0f1014",
        },
        border: "rgba(17, 25, 40, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "2rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        card: "0 18px 40px rgba(15, 23, 42, 0.06)",
        hover: "0 20px 50px rgba(15, 23, 42, 0.12)",
        "card-dark": "0 24px 44px rgba(3, 7, 18, 0.25)",
        "hover-dark": "0 32px 60px rgba(3, 7, 18, 0.35)",
      },
      letterSpacing: {
        tightest: "-0.05em",
        tight: "-0.02em",
      },
      keyframes: {
        ripple: {
          "0%": {
            transform: "scale(0)",
            opacity: "0.4",
          },
          "100%": {
            transform: "scale(3)",
            opacity: "0",
          },
        },
        fadeIn: {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
        slideUp: {
          "0%": {
            transform: "translateY(20px)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
        scaleIn: {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
        },
      },
      animation: {
        ripple: "ripple 650ms ease-out",
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 300ms ease-out",
        "scale-in": "scaleIn 200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
    },
  },
  plugins: [],
};

export default config;
