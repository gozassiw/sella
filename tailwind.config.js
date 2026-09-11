/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#0E5E4A", dark: "#094234", light: "#E3F0EC" },
        mango: "#FFB020",
        surface: "#F5F7F6",
        ink: "#16211D",
        muted: "#5E6B66",
        line: "#DCE3E0",
      },
      fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
