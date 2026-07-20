/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-driven CSS variables consumed by both Tailwind and inline SVG.
        bg: "var(--bg)",
        surface: "var(--surface)",
        grid: "var(--grid)",
        "grid-strong": "var(--grid-strong)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        today: "var(--today)",
        weekend: "var(--weekend)",
      },
      fontFamily: {
        sans: ["var(--font)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        bar: "0 1px 2px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.06)",
        "bar-drag": "0 6px 16px rgba(0,0,0,0.22), 0 2px 4px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
