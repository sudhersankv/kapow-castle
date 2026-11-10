import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
