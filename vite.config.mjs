import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Set before forked test workers start: reservation boundaries use Korean time.
process.env.TZ = 'Asia/Seoul';

export default defineConfig({
  plugins: [react()],
  base: '/',
  envPrefix: ['VITE_', 'REACT_APP_'],
  build: { outDir: 'build', target: 'es2020' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
    pool: 'forks',
    maxWorkers: 2,
    mockReset: true,
  },
});
