/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aviation-blue': '#1a365d',
        'aviation-sky': '#3182ce',
        'sid-color': '#48bb78',
        'enroute-color': '#4299e1',
        'star-color': '#ed8936',
        'approach-color': '#e53e3e',
        'taxi-color': '#9f7aea',
      },
    },
  },
  plugins: [],
}
