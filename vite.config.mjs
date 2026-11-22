import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// שלושה דפים: המשחק, ניהול, סימולטור טלפון
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'web/index.html'),
        admin: resolve(__dirname, 'web/admin.html'),
        sim: resolve(__dirname, 'web/sim.html'),
      },
    },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8787', '/yemot': 'http://127.0.0.1:8787' } },
});
