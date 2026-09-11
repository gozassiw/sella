/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#243A92", dark: "#182865", light: "#E9EDFF" },
        mango: "#E6A23C",
        coral: "#E86E61",
        surface: "#FFF9F1",
        ink: "#20243A",
        muted: "#69708A",
        line: "#EEE5D8",
      },
      fontFamily: { sans: ["var(--font-sora)", "Trebuchet MS", "system-ui", "sans-serif"], serif: ["Georgia", "Cambria", "Times New Roman", "serif"] },
    },
  },
  plugins: [],
};
