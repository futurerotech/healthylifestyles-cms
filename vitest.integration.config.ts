import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: {
    '@payload-config': fileURLToPath(new URL('./payload.config.ts', import.meta.url)),
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
