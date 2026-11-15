import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  },
  preload: {
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    plugins: [react()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
