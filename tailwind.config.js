/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        red: { brand: "#e82020", deep: "#b51616" },
        cream: "#f3d39b",
        paper: "#f6efe4",
        ink: "#0a0908",
        coal: "#161311",
      },
      fontFamily: {
        display: ["Oswald", "Impact", "sans-serif"],
        heading: ["Oswald", "Impact", "sans-serif"],
        script: ["'Kaushan Script'", "cursive"],
        sans: ["Inter", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
