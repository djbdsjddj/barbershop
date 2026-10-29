import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#09090B",
        surface: "#111216",
        raised: "#181A20",
        line: { DEFAULT: "#22252D", strong: "#2E323C" },
        ink: { DEFAULT: "#F2F0EB", muted: "#9A9CA5", faint: "#5E616B" },
        brass: { DEFAULT: "#E5A93C", hover: "#F0BA55", deep: "#B9862A", ink: "#09090B" },
        status: {
          confirmed: "#3B82F6",
          "in-chair": "#F59E0B",
          completed: "#10B981",
          cancelled: "#EF4444",
          blocked: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // ponytail: modular scale (1.25) — tweak here, not per-component
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        display: ["3.05rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" }],
      },
      borderRadius: { card: "14px", control: "10px" },
      boxShadow: {
        card: "0 0 0 1px #22252D, 0 12px 32px -16px rgba(0,0,0,0.7)",
        brass: "0 0 0 1px rgba(229,169,60,0.5), 0 8px 24px -10px rgba(229,169,60,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
