/** Configure local serving and isolated component verification. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    server: { host: env.VITE_HOST || '127.0.0.1', port: Number(env.VITE_PORT || 5173), strictPort: true },
    preview: { host: env.VITE_HOST || '127.0.0.1', port: Number(env.VITE_PREVIEW_PORT || 4173), strictPort: true },
    test: {
      environment: 'jsdom',
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      pool: 'forks',
      maxWorkers: 1,
      minWorkers: 1,
    },
  };
});
