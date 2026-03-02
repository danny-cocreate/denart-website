// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://denartny.com',
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['webmcp-kit', 'zod'],
    },
  },
  integrations: [sitemap()],
  redirects: {
    '/testimonials': '/reviews',
  },
});