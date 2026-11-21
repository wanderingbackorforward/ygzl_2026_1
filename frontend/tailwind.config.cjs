/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 语义色映射到 design-tokens，避免第三套调色板继续扩散
      colors: {
        ok: 'var(--ds-ok)',
        warn: 'var(--ds-warn)',
        danger: 'var(--ds-danger)',
        info: 'var(--ds-info)',
        accent: 'var(--ds-accent)',
        surface: 'var(--ds-surface)',
        'ds-border': 'var(--ds-border)',
        'text-main': 'var(--ds-text)',
        'text-sub': 'var(--ds-text-secondary)',
        'text-muted': 'var(--ds-text-muted)',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
}

