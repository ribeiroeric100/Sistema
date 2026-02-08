import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        'background-light': '#f8fafc',
        'background-dark': '#020617',
        secondary: '#2dd4bf',
        accent: '#8b5cf6',
        surface: {
          light: '#ffffff',
          dark: '#0f172a'
        }
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        '2xl': '1.5rem'
      }
    }
  },
  plugins: [forms, typography]
}
