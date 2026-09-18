/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sitechai: {
          sidebar: '#11074a',
          sidebarHover: '#1c106b',
          sidebarActive: '#22157d',
          accent: '#2563eb',
          darkCard: '#130a52',
          bg: '#f4f6fa'
        }
      }
    },
  },
  plugins: [],
}
