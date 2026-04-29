import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@components': r('./src/components'),
      '@screens': r('./src/screens'),
      '@styles': r('./src/styles'),
      '@util': r('./src/core/util'),
    },
  },
  worker: {
    format: 'es',
  },
});
