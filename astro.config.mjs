// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { validateContent } from './src/lib/validate.ts';

/**
 * Fails `astro build` on duplicate IDs, invalid enums, broken references or unsourced facts.
 * @returns {import('astro').AstroIntegration}
 */
function contentIntegrity() {
  const root = fileURLToPath(new URL('.', import.meta.url));
  return {
    name: 'pathology-atlas:content-integrity',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const { errors, warnings } = validateContent(root);
        warnings.forEach((w) => logger.warn(w));
        if (errors.length) {
          errors.forEach((e) => logger.error(e));
          throw new Error(`Content integrity check failed with ${errors.length} error(s).`);
        }
        logger.info('content integrity check passed');
      },
      'astro:server:start': ({ logger }) => {
        const { errors } = validateContent(root);
        errors.forEach((e) => logger.warn(`content: ${e}`));
      },
    },
  };
}

// GitHub Pages serves a project site under /<repo>/. The deploy workflow sets
// SITE_URL and BASE_PATH; locally both default to a root-served site.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [contentIntegrity()],
  vite: {
    plugins: [tailwindcss()],
  },
});
