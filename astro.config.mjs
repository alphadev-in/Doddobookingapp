// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import 'dotenv/config';

// Hybrid-ready: pages are static unless they export `prerender = false`.
// Public marketing pages are prerendered and listed in /sitemap-index.xml.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://doddo.co.uk",
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    sitemap({
      // Only public, indexable pages. Dashboard, auth, booking and manage pages are excluded.
      filter: (page) => !/\/(dashboard|onboarding|login|booking|book|api)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  server: { port: 4321 },
});
