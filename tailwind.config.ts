import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Keidence brand palette — deep teal accent, neutral surfaces
        brand: {
          50: "#eefdfb",
          100: "#d4f7f2",
          200: "#adece5",
          300: "#77dcd3",
          400: "#3fc3ba",
          500: "#1aa79f",
          600: "#0f8781",
          700: "#116b68",
          800: "#135554",
          900: "#144746",
          950: "#052a2a",
        },
        // Surface + ink flip between light and dark via CSS variables set in
        // globals.css (:root and .dark).
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,30,0.04), 0 4px 16px rgba(15,27,30,0.06)",
        pop: "0 8px 32px rgba(15,27,30,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
