/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,astro}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          400: '#007d8a',
          500: '#006874',
        },
        // 新增自訂顏色，專門給文字使用
        customText: '#e6ddd2',
      },
    },
  },
  plugins: [],
}