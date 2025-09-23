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
      },
      letterSpacing: {
        tightest: "-0.05em",
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
      },
      animation: {
        ripple: "ripple 650ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
