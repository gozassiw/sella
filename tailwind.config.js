/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#1B2A57", dark: "#142044", light: "#E9ECF4" },
        mango: "#D4A64A",
        coral: "#D8796B",
        surface: "#F7F4EE",
        ink: "#202536",
        muted: "#687083",
        line: "#E5E1D8",
      },
      fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"], serif: ["var(--font-sora)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
