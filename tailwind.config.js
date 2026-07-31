/**
 * Tailwind config for FOP Financial Management System.
 * Adapts docs/design-system/16-tailwind.config.ts to Vite + JS (per locked stack).
 * Consumes CSS custom properties from src/index.css (sourced from docs/design-system/15-tokens.json).
 * Mobile-first; semantic colors only via tokens; no hardcoded hex outside index.css.
 */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './pages/**/*.{js,jsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', md: '1.5rem', lg: '2rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '80rem' },
    },
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    fontSize: {
      display:   ['2.25rem',   { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      h1:        ['1.875rem',  { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
      h2:        ['1.5rem',    { lineHeight: '1.25', letterSpacing: '-0.01em' }],
      h3:        ['1.25rem',   { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
      h4:        ['1.125rem',  { lineHeight: '1.4' }],
      'body-l':  ['1.0625rem', { lineHeight: '1.5' }],
      'body-m':  ['1rem',      { lineHeight: '1.5' }],
      caption:   ['0.75rem',   { lineHeight: '1.45', letterSpacing: '0.02em' }],
      mono:      ['1rem',      { lineHeight: '1.5' }],
    },
    fontWeight: { regular: '400', medium: '500', semibold: '600' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      brand: {
        50: 'var(--brand-50)', 100: 'var(--brand-100)', 200: 'var(--brand-200)',
        300: 'var(--brand-300)', 400: 'var(--brand-400)', 500: 'var(--brand-500)',
        600: 'var(--brand-600)', 700: 'var(--brand-700)', 800: 'var(--brand-800)',
        900: 'var(--brand-900)', DEFAULT: 'var(--brand-600)',
      },
      success: {
        50: 'var(--success-50)', 100: 'var(--success-100)', 500: 'var(--success-500)',
        600: 'var(--success-600)', 700: 'var(--success-700)', DEFAULT: 'var(--success-500)',
      },
      danger: {
        50: 'var(--danger-50)', 100: 'var(--danger-100)', 500: 'var(--danger-500)',
        600: 'var(--danger-600)', 700: 'var(--danger-700)', DEFAULT: 'var(--danger-500)',
      },
      warning: {
        50: 'var(--warning-50)', 500: 'var(--warning-500)',
        600: 'var(--warning-600)', 700: 'var(--warning-700)', DEFAULT: 'var(--warning-500)',
      },
      info: {
        50: 'var(--info-50)', 500: 'var(--info-500)',
        700: 'var(--info-700)', DEFAULT: 'var(--info-500)',
      },
      neutral: {
        50: 'var(--neutral-50)', 100: 'var(--neutral-100)', 200: 'var(--neutral-200)',
        300: 'var(--neutral-300)', 400: 'var(--neutral-400)', 500: 'var(--neutral-500)',
        600: 'var(--neutral-600)', 700: 'var(--neutral-700)', 800: 'var(--neutral-800)',
        900: 'var(--neutral-900)',
      },
      bg: {
        page: 'var(--bg-page)', surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)', sunken: 'var(--bg-sunken)',
        overlay: 'var(--bg-overlay)',
      },
      text: {
        primary: 'var(--text-primary)', secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)', disabled: 'var(--text-disabled)',
        inverse: 'var(--text-inverse)', link: 'var(--text-link)',
      },
      border: {
        subtle: 'var(--border-subtle)', DEFAULT: 'var(--border-default)',
        strong: 'var(--border-strong)', focus: 'var(--border-focus)',
      },
    },
    borderRadius: {
      none: '0', sm: '0.25rem', md: '0.5rem',
      lg: '0.75rem', xl: '1rem', full: '9999px',
    },
    boxShadow: {
      none: 'none', flat: 'none',
      card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
      raised: '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.06)',
      overlay: '0 24px 48px rgba(15,23,42,0.18)',
      focus: '0 0 0 2px var(--brand-600)',
    },
    transitionDuration: {
      '0': '0ms', '150': '150ms', '250': '250ms',
      '400': '400ms', '1500': '1500ms',
    },
    zIndex: {
      hide: '-1', base: '0', raised: '10', sticky: '20',
      fab: '30', modal: '40', toast: '50', tooltip: '60',
    },
    extend: {
      size: {
        '16': '1rem', '20': '1.25rem', '24': '1.5rem',
        '32': '2rem', '48': '3rem',
      },
      maxWidth: { content: '80rem' },
    },
  },
  plugins: [],
}