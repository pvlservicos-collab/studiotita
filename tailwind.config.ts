import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#fbf8f0",
          100: "#f5ecd6",
          200: "#ecd9ac",
          300: "#e0c078",
          400: "#d4a94f",
          500: "#c79a3c",
          600: "#a87c2c",
          700: "#846025",
          800: "#6b4e24",
          900: "#5a4122",
        },
        ink: {
          50: "#f7f7f8",
          100: "#eceef0",
          200: "#d7dbe0",
          300: "#b3bac2",
          400: "#8a94a0",
          500: "#69737f",
          600: "#525a66",
          700: "#414753",
          800: "#2b2f38",
          900: "#181b21",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 43, 0.08)",
        goldGlow: "0 0 0 1px rgba(212,169,79,0.35), 0 8px 24px -4px rgba(212,169,79,0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
