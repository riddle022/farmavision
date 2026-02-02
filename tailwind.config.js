/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0a',
          800: '#121212',
          700: '#1a1a1a',
          600: '#232323',
          500: '#2d2d2d',
        },
        orange: {
          400: '#ff8c42',
          500: '#ff7425',
          600: '#e85d04',
          700: '#dc2f02',
        },
        teal: {
          400: '#4dd4ac',
          500: '#2ec4b6',
          600: '#06aed5',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
