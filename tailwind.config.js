/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sea: {
          900: '#04121f',
          800: '#082438',
          700: '#0d3450',
          600: '#14496d',
          500: '#1c6294',
        },
      },
      keyframes: {
        splash: {
          '0%': { transform: 'scale(0.4)', opacity: '0.2' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        blast: {
          '0%': { transform: 'scale(0.3)', opacity: '0.3' },
          '50%': { transform: 'scale(1.25)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        splash: 'splash 320ms ease-out',
        blast: 'blast 360ms ease-out',
      },
    },
  },
  plugins: [],
};
