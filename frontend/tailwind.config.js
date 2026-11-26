/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#1d2350",
          accent: "#af514a",
          beige: "#dedac7",
          primary: "#4f46e5",
          in: "#16a34a",
          out: "#ef4444",
          male: "#3b82f6",
          female: "#ec4899",
          unknown: "#9ca3af",
          bg: "#f8fafc",
          surface: "#ffffff",
          text: "#0f172a",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
      }
    },
  },
  plugins: [],
};
