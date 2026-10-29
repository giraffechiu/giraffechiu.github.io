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
        amber: {
          400: '#eaa486',          
        },        
        // 新增自訂顏色，專門給文字使用
        customText: '#c5b9ac', // #e6ddd2
        highlight: '#eaa486',
        logocolor: '#839794',
        greygrey: '#75817f',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
}