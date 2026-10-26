import plugin from 'tailwindcss/plugin'

// Theme colours live in CSS variables (src/index.css) so one set of classes serves both themes.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // `white` is the foreground: white in dark mode, warm ink in light mode, so every
        // text-white, border-white/10 and bg-white/5 follows the theme.
        white: token('fg'),
        page: { DEFAULT: token('page'), 2: token('page-2'), 3: token('page-3') },
        panel: token('panel'),
        accent: { DEFAULT: token('accent'), soft: token('accent-soft'), hi: token('accent-hi') },
      },
    },
  },
  // `light:` for the few one-off tweaks the tokens don't cover.
  plugins: [plugin(({ addVariant }) => addVariant('light', 'html[data-theme="light"] &'))],
}
