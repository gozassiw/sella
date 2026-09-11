/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#6657F5", dark: "#4D40D3", light: "#ECEAFF" },
        mango: "#D7FF4F",
        coral: "#FF6B5F",
        surface: "#F3F3EF",
        ink: "#171717",
        muted: "#707070",
        line: "#D9D9D2",
      },
      fontFamily: { sans: ["Arial", "Helvetica Neue", "system-ui", "sans-serif"], serif: ["Arial Black", "Arial", "Helvetica Neue", "sans-serif"] },
    },
  },
  plugins: [],
};
