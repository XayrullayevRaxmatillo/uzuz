/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens (see index.css)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-2': 'rgb(var(--bg-2) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        // Brand
        violet: { DEFAULT: '#7C3AED', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' },
        indigo: { DEFAULT: '#4F46E5', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5' },
        cyan: { DEFAULT: '#22D3EE', 300: '#67E8F9', 400: '#22D3EE', 600: '#0891B2' },
        coral: { DEFAULT: '#FF6B6B', 400: '#FF8787', 600: '#E5484D' },
        navy: { 950: '#0A0F2C', 900: '#121A3A', 800: '#1B2552', 700: '#26326B' },
        ans: { a: '#FF6B6B', b: '#4F7BFF', c: '#F5B731', d: '#1FBF8F' }
      },
      fontFamily: {
        display: ['Unbounded', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      borderRadius: {
        panel: '28px',
        card: '20px',
        btn: '14px'
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--line) / 0.12), 0 12px 40px -12px rgba(124, 58, 237, 0.45)',
        lift: '0 18px 50px -20px rgba(10, 15, 44, 0.55)',
        'inset-line': 'inset 0 0 0 1px rgb(var(--line) / 0.10)'
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        drift: { '0%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(4%, -3%) scale(1.08)' }, '100%': { transform: 'translate(0,0) scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%': { transform: 'scale(0.9)', opacity: '0.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulseRing 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
};
