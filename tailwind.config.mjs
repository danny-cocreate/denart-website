/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#C41E3A',
          'red-hover': '#E62E4A',
          'red-light': '#DD4458',
          gold: '#D4AF37',
          'gold-hover': '#B8962E',
          'gold-light': '#E8C547',
          orange: '#E67E22',
          blue: '#3498DB',
          purple: '#8B5CF6',
        },
        // Platform colors
        yelp: '#D32323',
        google: '#4285F4',
        // Dark theme surfaces - tinted neutrals
        void: '#0D0D0D',
        'void-light': '#1A1A1A',
        'void-lighter': '#222222',
        deepest: '#07070a',
        dark: '#0c0c12',
        surface: '#111118',
        elevated: '#18181f',
        // Text colors - warm whites
        sand: '#f5f5f5',
        'sand-dim': '#aaaaaa',
        'sand-muted': '#888888',
        // Borders
        'border-default': '#2a2a35',
        'border-hover': '#4a3a5f',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Lato', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
