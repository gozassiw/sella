/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#1B2A57", dark: "#142044", light: "#EEF1F7" },
        mango: "#E8A33D",
        surface: "#FAF9F6",
        ink: "#14171F",
        muted: "#6B7280",
        line: "#E7E5DE",
        success: "#1E7A4C",
        warning: "#B7791F",
        danger: "#B91C1C",
      },
      fontFamily: { sans: ["var(--font-inter)"], serif: ["var(--font-fraunces)"] },
    },
  },
  plugins: [],
};
