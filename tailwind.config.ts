import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Keidence brand palette — vivid magenta (matches the store logo).
        // 600/700 are the primary-button shades: dark enough that white text
        // stays legible; 50/100 are soft tinted backgrounds for chips/panels.
        brand: {
          50: "#fdf0fe",
          100: "#fbe0fd",
          200: "#f7bffb",
          300: "#f28ef7",
          400: "#ea4ff1",
          500: "#e100f5", // logo magenta
          600: "#c400d6",
          700: "#a000ad",
          800: "#82088c",
          900: "#6c0c73",
          950: "#48004d",
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
