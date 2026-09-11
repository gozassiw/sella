/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#1B2A57", dark: "#142044", light: "#E7EBF5" },
        mango: "#E8A33D",
        surface: "#F7F5F0",
        ink: "#1F2430",
        muted: "#5C6478",
        line: "#E2E1DA",
      },
      fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
