/** Preserve editorial light values and switch shared presentation roles. */
import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

const light = {
  background: colors.slate[50], surface: '#ffffff', 'surface-raised': colors.indigo[50],
  foreground: colors.slate[900], 'foreground-muted': colors.slate[600], border: colors.slate[300],
  ring: colors.indigo[600], success: colors.emerald[800], 'success-light': colors.emerald[50],
  warning: colors.amber[900], 'warning-light': colors.amber[50],
  error: colors.red[700], 'error-light': colors.red[50], info: colors.indigo[800], 'info-light': colors.indigo[50],
};
const dark = {
  background: '#0f1117', surface: '#191c24', 'surface-raised': '#252936',
  foreground: colors.slate[100], 'foreground-muted': colors.slate[300], border: colors.slate[600],
  ring: colors.indigo[400], success: colors.emerald[300], 'success-light': '#12352b',
  warning: colors.amber[200], 'warning-light': '#382c16',
  error: colors.red[300], 'error-light': '#3b2025', info: colors.indigo[200], 'info-light': '#272b46',
};

/** Convert a palette to inheritable RGB channels for opacity-capable utilities. */
function variables(palette) {
  return Object.fromEntries(Object.entries(palette).map(([name, hex]) => [
    `--color-${name}`, [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(' '),
  ]));
}

/** Reference a presentation role without changing existing utility names. */
function role(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

const scales = { primary: colors.indigo, secondary: colors.violet, neutral: colors.slate };
const lightScales = {};
const darkScales = {};
const darkText = { '[data-theme="dark"] .text-surface': { color: '#ffffff' } };
for (const [name, scale] of Object.entries(scales)) {
  for (const [shade, value] of Object.entries(scale)) {
    lightScales[`${name}-${shade}`] = value;
    darkScales[`${name}-${shade}`] = name === 'neutral'
      ? scale[1000 - Number(shade)]
      : Number(shade) <= 200 ? scale[950] : value;
    if (name !== 'neutral' && Number(shade) >= 500) {
      darkText[`[data-theme="dark"] .text-${name}-${shade}`] = { color: scale[300] };
    }
  }
}

/** Keep inherited scale utilities while making pale decorative surfaces theme-aware. */
function scaleRoles(name) {
  return Object.fromEntries(Object.keys(scales[name]).map((shade) => [shade, role(`${name}-${shade}`)]));
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: scaleRoles('primary'),
        secondary: scaleRoles('secondary'),
        neutral: scaleRoles('neutral'),
        accent: { pink: colors.pink[600], teal: colors.teal[600] },
        background: role('background'),
        surface: role('surface'),
        'surface-raised': role('surface-raised'),
        foreground: role('foreground'),
        'foreground-muted': role('foreground-muted'),
        border: role('border'),
        ring: role('ring'),
        success: { DEFAULT: role('success'), light: role('success-light') },
        warning: { DEFAULT: role('warning'), light: role('warning-light') },
        error: { DEFAULT: role('error'), light: role('error-light') },
        info: { DEFAULT: role('info'), light: role('info-light') },
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
  plugins: [plugin(({ addBase }) => {
    addBase({
      ':root, [data-theme="light"]': { ...variables({ ...light, ...lightScales }), colorScheme: 'light' },
      '[data-theme="dark"]': { ...variables({ ...dark, ...darkScales }), colorScheme: 'dark' },
      ...darkText,
    });
  })],
};
