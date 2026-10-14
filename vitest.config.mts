import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80},
    }
  },
  plugins: [swc.vite()],
});
