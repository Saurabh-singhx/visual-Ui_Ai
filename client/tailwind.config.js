/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          850: '#18181b',
          900: '#121212',
          925: '#0d0d0d',
          950: '#000000',
        },
        brand: {
          primary: '#ea580c',   // Orange-600
          hover: '#f97316',     // Orange-500
          accent: '#ff6600',    // Vivid Orange
          dark: '#000000',
          surface: '#0d0d0d',
          border: 'rgba(255, 255, 255, 0.12)',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
