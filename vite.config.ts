import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The geometry suite walks all 294 cells x 4 directions exhaustively.
    testTimeout: 30_000,
  },
});
