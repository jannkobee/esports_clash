/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bronze: '#cd7f32',
        silver: '#c0c0c0',
        gold: '#ffd700',
        platinum: '#00f0ff',
        diamond: '#3b82f6',
        goat: '#ec4899',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)' },
          '100%': { boxShadow: '0 0 30px rgba(236, 72, 153, 1), 0 0 50px rgba(255, 215, 0, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}

