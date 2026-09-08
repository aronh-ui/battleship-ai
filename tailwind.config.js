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
        'slide-in': {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        banner: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '12%': { transform: 'scale(1)', opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        'ping-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        swell: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        reticle: {
          '0%': { transform: 'scale(2.2)', opacity: '0' },
          '35%': { opacity: '1' },
          '100%': { transform: 'scale(0.85)', opacity: '0.9' },
        },
        shock: {
          '0%': { transform: 'scale(0.2)', opacity: '0.9' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        smoke: {
          '0%': { transform: 'translateY(0) scale(0.7)', opacity: '0.55' },
          '100%': { transform: 'translateY(-70%) scale(1.5)', opacity: '0' },
        },
        settle: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(6%) rotate(-1.5deg)', opacity: '0.92' },
        },
      },
      animation: {
        splash: 'splash 320ms ease-out',
        blast: 'blast 360ms ease-out',
        'slide-in': 'slide-in 220ms ease-out',
        banner: 'banner 2.4s ease-out forwards',
        scan: 'scan 1.1s linear infinite',
        'ping-slow': 'ping-slow 1.2s ease-in-out infinite',
        swell: 'swell 18s ease-in-out infinite',
        sweep: 'sweep 4s linear infinite',
        reticle: 'reticle 420ms ease-out',
        shock: 'shock 520ms ease-out',
        smoke: 'smoke 2.4s ease-out infinite',
        settle: 'settle 700ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
