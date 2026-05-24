/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],

  theme: {
    extend: {
      /*
       * Conectar tokens CSS → utilidades Tailwind.
       * Así puedes escribir `bg-surface`, `text-accent`, `border-line`
       * y Tailwind genera las clases que internamente usan var(--...).
       *
       * Los tokens viven en global.css — Tailwind solo los expone
       * como clases. Si cambias el valor del token, ambos se actualizan.
       */
      colors: {
        base:      'var(--bg-base)',
        surface:   'var(--bg-surface)',
        raised:    'var(--bg-raised)',
        overlay:   'var(--bg-overlay)',
        accent:    'var(--accent)',
        live:      'var(--live)',
        line:      'var(--border)',          // `border-line`
        'primary':   'var(--text-primary)',
        'secondary': 'var(--text-secondary)',
        'muted':     'var(--text-muted)',
      },

      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        body:    ['Barlow', 'sans-serif'],
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },

      transitionDuration: {
        DEFAULT: '150ms',
      },

      /*
       * Breakpoints estándar — no cambiamos los de Tailwind,
       * solo dejamos constancia de cuáles usamos en este proyecto.
       * sm: 640px, md: 768px, lg: 1024px, xl: 1280px
       */

      maxWidth: {
        content: '1280px',
      },

      /*
       * Animaciones registradas en Tailwind para usarlas con `animate-*`.
       * Las @keyframes equivalentes están en global.css.
       */
      animation: {
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        'fade-in':   'fade-in 0.3s ease forwards',
        'slide-up':  'slide-up 0.4s ease forwards',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.4', transform: 'scale(0.7)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },

  plugins: [],
};
