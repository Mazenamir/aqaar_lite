import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#003527",
          container: "#064e3b",
          fixed: "#b0f0d6",
          "fixed-dim": "#95d3ba",
        },
        "on-primary": {
          DEFAULT: "#ffffff",
          container: "#80bea6",
          fixed: "#002117",
          "fixed-variant": "#0b513d",
        },
        secondary: {
          DEFAULT: "#406655",
          container: "#bfe9d3",
          fixed: "#c2ecd6",
          "fixed-dim": "#a6d0bb",
        },
        "on-secondary": {
          DEFAULT: "#ffffff",
          container: "#446a59",
          fixed: "#002115",
          "fixed-variant": "#284e3e",
        },
        tertiary: {
          DEFAULT: "#3d2b0d",
          container: "#564121",
          fixed: "#fedeb2",
          "fixed-dim": "#e0c298",
        },
        "on-tertiary": {
          DEFAULT: "#ffffff",
          container: "#cbad85",
          fixed: "#281800",
          "fixed-variant": "#584323",
        },
        surface: {
          DEFAULT: "#faf8ff",
          dim: "#d2d9f4",
          bright: "#faf8ff",
          container: {
            lowest: "#ffffff",
            low: "#f2f3ff",
            DEFAULT: "#eaedff",
            high: "#e2e7ff",
            highest: "#dae2fd",
          },
          variant: "#dae2fd",
          tint: "#2b6954",
        },
        "on-surface": {
          DEFAULT: "#131b2e",
          variant: "#404944",
        },
        outline: {
          DEFAULT: "#707974",
          variant: "#bfc9c3",
        },
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        "on-error": {
          DEFAULT: "#ffffff",
          container: "#93000a",
        },
      },
      fontFamily: {
        sans: ["var(--font-alexandria)", "Alexandria", "system-ui", "sans-serif"],
        mono: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "monospace"],
        num: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "var(--font-alexandria)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
