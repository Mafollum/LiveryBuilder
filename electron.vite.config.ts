import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // dependencies are bundled into the build, so windows/app runs with a plain Electron runtime (no node_modules)
  main: {
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: { externalizeDeps: false },
  },
  preload: {
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: { externalizeDeps: false },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    plugins: [
      react(),
      {
        // the ONNX runtime's .wasm is handed to the renderer by the main process (see src/main/ai.ts),
        // so the copy Vite finds through the runtime's own URL reference is never used
        name: 'drop-unused-ort-wasm',
        generateBundle(_options, bundle) {
          for (const name of Object.keys(bundle)) if (name.endsWith('.wasm')) delete bundle[name];
        },
      },
    ],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
