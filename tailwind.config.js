/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e6f0ff',
          100: '#b3d1ff',
          200: '#80b3ff',
          300: '#4d94ff',
          400: '#1a75ff',
          500: '#003d82',
          600: '#003366',
          700: '#00284d',
          800: '#001e3a',
          900: '#001427',
          950: '#000a13',
        },
        steel: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#5a6268',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
        },
      },
    },
  },
  plugins: [],
};
