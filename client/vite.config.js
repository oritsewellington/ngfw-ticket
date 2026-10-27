import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // In development, /api calls are forwarded to the Express server, so no client .env is needed.
      proxy: { '/api': { target: env.DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true } },
    },
  };
});
