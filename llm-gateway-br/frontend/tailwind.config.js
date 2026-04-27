/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d9e2fe',
          300: '#b9c8fe',
          400: '#8fa6fc',
          500: '#667eea',
          600: '#5568d3',
          700: '#4552b5',
          800: '#3a4493',
          900: '#343b75',
        },
      },
    },
  },
  plugins: [],
}
