/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        slideUp: 'slideUp 0.3s ease forwards'
      }
    }
  },
  plugins: []
};
