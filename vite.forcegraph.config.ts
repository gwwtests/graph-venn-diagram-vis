import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/forcegraph',
  build: {
    outDir: '../../../dist-forcegraph',
    emptyOutDir: true,
  },
});
