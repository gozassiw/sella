/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kola: { DEFAULT: "#182243", dark: "#10172F", light: "#E9ECF4" },
        mango: "#C8943E",
        surface: "#F7F3EC",
        ink: "#202536",
        muted: "#687083",
        line: "#E9E3D8",
      },
      fontFamily: { sans: ["var(--font-sora)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
