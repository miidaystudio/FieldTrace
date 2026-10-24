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
          base: '#FAF8F5',
          panel: '#FFFFFF',
          card: '#FFFFFF',
          hover: '#F5F1EA',
          border: '#EBE6DF',
          borderHighlight: '#D8D1C5',
        },
        brand: {
          teal: '#E85D38',
          coral: '#E85D38',
          coralLight: '#FFF2ED',
          coralBorder: '#FCD4C7',
          emerald: '#10B981',
          cyan: '#EA580C',
          tealDark: '#D94F2B',
        },
        status: {
          verified: '#10B981',
          moving: '#E85D38',
          idle: '#F59E0B',
          stale: '#78716C',
          flagged: '#EF4444',
          deviated: '#F97316',
        }
      },
      boxShadow: {
        'card-soft': '0 10px 30px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.02)',
        'card-hover': '0 20px 45px rgba(28, 25, 23, 0.08), 0 2px 6px rgba(28, 25, 23, 0.03)',
        'coral-glow': '0 10px 25px rgba(232, 93, 56, 0.35)',
      },
      fontFamily: {
        sans: ['Comfortaa', 'Inter', 'Outfit', 'system-ui', 'sans-serif'],
        comfortaa: ['Comfortaa', 'sans-serif'],
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
