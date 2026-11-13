/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sentinel: {
          dark: '#070B14',
          card: '#0D1527',
          surface: '#111C38',
          border: '#1E293B',
          hover: '#162347',
          primary: '#6366F1',
          accent: '#8B5CF6',
          cyan: '#06B6D4',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

