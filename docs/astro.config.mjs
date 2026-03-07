// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://ianhuntisaak.github.io',
  base: '/anki-defs',
  vite: {
    server: {
      allowedHosts: ['pop-os'],
    },
  },
  integrations: [
    starlight({
      title: 'anki-defs',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/ianhuntisaak/anki-defs',
        },
      ],
      sidebar: [
        { label: 'Home', slug: '' },
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Usage Guide', slug: 'usage' },
        { label: 'Tailscale Setup', slug: 'tailscale' },
        { label: 'Architecture', slug: 'architecture' },
        { label: 'Anki Add-on', slug: 'anki-addon' },
      ],
    }),
  ],
});
