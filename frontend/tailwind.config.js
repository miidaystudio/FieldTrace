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
        ops: {
          base: '#0B0F17',
          panel: '#151C28',
          card: '#18202F',
          hover: '#1F293D',
          border: '#202938',
          borderHighlight: '#334155',
        },
        brand: {
          teal: '#5EEAD4',
          emerald: '#10B981',
          cyan: '#06B6D4',
          tealDark: '#0D9488',
        },
        status: {
          verified: '#10B981',
          moving: '#5EEAD4',
          idle: '#FBBF24',
          stale: '#94A3B8',
          flagged: '#F43F5E',
          deviated: '#FB7185',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(1.15)' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
