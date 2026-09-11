/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#176B4D", dark: "#0F5139", light: "#E2F2E8" },
        mango: "#B9E769",
        surface: "#F3F8F4",
        ink: "#10241C",
        muted: "#63746B",
        line: "#DCE9E0",
        success: "#1E7A4C",
        warning: "#B7791F",
        danger: "#B91C1C",
      },
      fontFamily: { sans: ["var(--font-body)"], serif: ["var(--font-display)"] },
    },
  },
  plugins: [],
};
