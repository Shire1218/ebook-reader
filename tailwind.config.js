/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 暖色调主题
        warm: {
          50: '#FAF8F5',
          100: '#F5F0EA',
          200: '#E8DFD4',
          300: '#D4C5B3',
          400: '#C8875E',
          500: '#B07348',
          600: '#965E38',
          700: '#7A4B2E',
          800: '#2C2420',
          900: '#1A1512',
        },
        // 夜间模式
        night: {
          bg: '#1A1A1A',
          text: '#D4D4D4',
          accent: '#B8956A',
          surface: '#2A2A2A',
          border: '#3A3A3A',
        },
        // 护眼模式
        eye: {
          bg: '#E8F0E4',
          text: '#333333',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
