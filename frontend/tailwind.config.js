/** Define the light editorial brand and shared semantic treatments. */
import colors from 'tailwindcss/colors';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: colors.indigo,
        secondary: colors.violet,
        neutral: colors.slate,
        accent: { pink: colors.pink[600], teal: colors.teal[600] },
        background: colors.slate[50],
        surface: '#ffffff',
        'surface-raised': colors.indigo[50],
        foreground: colors.slate[900],
        'foreground-muted': colors.slate[600],
        border: colors.slate[300],
        ring: colors.indigo[600],
        success: { DEFAULT: colors.emerald[800], light: colors.emerald[50] },
        warning: { DEFAULT: colors.amber[900], light: colors.amber[50] },
        error: { DEFAULT: colors.red[700], light: colors.red[50] },
        info: { DEFAULT: colors.indigo[800], light: colors.indigo[50] },
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Arial', 'Helvetica', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      fontSize: { display: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.1', letterSpacing: '-0.03em' }] },
      borderRadius: { card: '1.25rem', control: '0.75rem' },
      boxShadow: { editorial: '0 12px 32px rgb(49 46 129 / 0.08), 0 2px 6px rgb(15 23 42 / 0.04)' },
      transitionDuration: { gentle: '240ms' },
      transitionTimingFunction: { gentle: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } } },
      animation: { float: 'float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
