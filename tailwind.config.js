/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: { red: { brand: "#e10600" } },
      fontFamily: {
        logo: ["'Playfair Display'", "serif"],
        heading: ["Fahkwang", "sans-serif"],
        sans: ["Inter", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
