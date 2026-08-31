// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://denartny.com',
  output: 'static',
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['webmcp-kit', 'zod'],
    },
    server: {
      proxy: {
        '/checkout-api': {
          target: 'https://checkout.denartny.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/checkout-api/, '/api'),
        },
      },
    },
  },
  integrations: [sitemap()],
  redirects: {
    '/testimonials': '/reviews',
    '/services/hypnotic-body-painting': '/services/embodied-manifestation',
  },
});