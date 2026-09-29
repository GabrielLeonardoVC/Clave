/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superfícies — claro: papel off-white quente
        app: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          raised: 'rgb(var(--c-raised) / <alpha-value>)',
          sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
          line: 'rgb(var(--c-line) / <alpha-value>)',
          'line-strong': 'rgb(var(--c-line-strong) / <alpha-value>)',
          // Texto
          ink: 'rgb(var(--c-ink) / <alpha-value>)',
          'ink-2': 'rgb(var(--c-ink-2) / <alpha-value>)',
          'ink-3': 'rgb(var(--c-ink-3) / <alpha-value>)',
        },
        // Azul royal — cor primária
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd1ff',
          300: '#8eb3ff',
          400: '#5a8bfa',
          500: '#3565e8',
          600: '#2b4fc9',
          700: '#253fa0',
          800: '#23377d',
          900: '#223263',
        },
        // Âmbar — destaque de acordes
        amber: {
          50: '#fff8ec',
          100: '#ffedcf',
          200: '#ffd79c',
          300: '#ffbb5e',
          400: '#f79c2c',
          500: '#e07d0d',
          600: '#bc5f06',
          700: '#96460a',
          800: '#7a390f',
          900: '#652f10',
        },
        // Emerald — ações confirmadas
        moss: {
          100: '#d3f3e3',
          300: '#6fd3a2',
          500: '#12925c',
          600: '#0d7a4d',
          700: '#0a5f3c',
        },
        // Vermelho — emergência
        danger: {
          100: '#ffe0dc',
          300: '#ff8f7f',
          500: '#e0342a',
          600: '#c0271e',
          700: '#9a1f18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.05), 0 1px 3px rgb(16 24 40 / 0.06)',
        lift: '0 8px 24px -6px rgb(16 24 40 / 0.14), 0 2px 6px -2px rgb(16 24 40 / 0.08)',
        sheet: '0 24px 64px -12px rgb(16 24 40 / 0.28)',
        glow: '0 0 0 1px rgb(var(--c-primary) / 0.25), 0 8px 32px -8px rgb(var(--c-primary) / 0.5)',
      },
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)', opacity: 0.4 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.94) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-left': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'beat': {
          '0%': { transform: 'scale(1)' },
          '16%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(220%)' } },
      },
      animation: {
        'sheet-in': 'sheet-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'pop-in': 'pop-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-left': 'slide-left 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        beat: 'beat 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        silk: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
