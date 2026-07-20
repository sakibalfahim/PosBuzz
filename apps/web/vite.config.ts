import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Load VITE_* from monorepo root .env (not only apps/web)
  loadEnv(mode, path.resolve(__dirname, '../..'), '');

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '../..'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
    },
  };
});
