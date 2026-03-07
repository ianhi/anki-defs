import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['ankiconnect-server/src/**/*.test.ts', 'client/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'client/src'),
      shared: resolve(__dirname, 'shared'),
    },
  },
});
