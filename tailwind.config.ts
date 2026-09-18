import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f6f7",
          100: "#e4e9eb",
          200: "#c7d1d5",
          300: "#a1aeb4",
          400: "#77878f",
          500: "#5a6b73",
          600: "#46545c",
          700: "#333f45",
          800: "#20282d",
          900: "#141a1e",
          950: "#0a0d0f",
        },
        accent: {
          300: "#7fe3d8",
          400: "#4fd6c6",
          500: "#22b8a8",
          600: "#188f83",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        widest2: "0.2em",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
