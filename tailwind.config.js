/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#137A52", dark: "#09543A", light: "#E4F4EB" },
        mango: "#C6F36A",
        surface: "#F5F8F5",
        ink: "#10231B",
        muted: "#6A776F",
        line: "#DDE7E0",
        success: "#1E7A4C",
        warning: "#B7791F",
        danger: "#B91C1C",
      },
      fontFamily: { sans: ["var(--font-jakarta)"], serif: ["var(--font-jakarta)"] },
    },
  },
  plugins: [],
};
