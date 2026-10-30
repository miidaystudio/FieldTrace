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
          base: '#0C0E12',
          panel: '#161920',
          card: '#161920',
          subcard: '#1E222B',
          header: '#161920',
          sidebar: '#161920',
          hover: '#1E222B',
          border: 'rgba(255, 255, 255, 0.05)',
          borderHighlight: 'rgba(255, 255, 255, 0.1)',
        },
        slate: {
          850: '#151F32',
        },
        brand: {
          blue: '#3B82F6',
          slate: '#8E96A4',
          crimson: '#E11D48',
          ochre: '#D97706',
          teal: '#3B82F6',
          emerald: '#10B981',
          cyan: '#38BDF8',
          tealDark: '#2563EB',
          coral: '#E85D38',
          coralLight: '#FFF2ED',
          coralBorder: '#FCD4C7',
        },
        status: {
          verified: '#FFFFFF',
          moving: '#3B82F6',
          idle: '#D97706',
          stale: '#64748B',
          flagged: '#E11D48',
          deviated: '#D97706',
        }
      },
      boxShadow: {
        'card-soft': '0 10px 30px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.02)',
        'card-hover': '0 20px 45px rgba(28, 25, 23, 0.08), 0 2px 6px rgba(28, 25, 23, 0.03)',
        'coral-glow': '0 10px 25px rgba(232, 93, 56, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
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
