import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, './server/src'),
      '@client': path.resolve(__dirname, './client/src'),
    },
  },
});
