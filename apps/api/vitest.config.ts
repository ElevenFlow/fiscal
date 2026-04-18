import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000, // RLS setup pode ser lento
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
