/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Tighter type scale for a denser admin console
      fontSize: {
        xs: ['0.6875rem', { lineHeight: '1rem' }],      // 11px
        sm: ['0.75rem', { lineHeight: '1.125rem' }],    // 12px
        base: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        lg: ['0.875rem', { lineHeight: '1.375rem' }],   // 14px
        xl: ['1rem', { lineHeight: '1.5rem' }],         // 16px
        '2xl': ['1.125rem', { lineHeight: '1.625rem' }],// 18px
        '3xl': ['1.375rem', { lineHeight: '1.75rem' }], // 22px
        '4xl': ['1.625rem', { lineHeight: '2rem' }],    // 26px
        '5xl': ['2rem', { lineHeight: '1' }],           // 32px
      },
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
    },
  },
  plugins: [],
};
