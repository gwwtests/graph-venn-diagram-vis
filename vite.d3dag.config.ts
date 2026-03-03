import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/d3dag',
  build: {
    outDir: '../../../dist-d3dag',
    emptyOutDir: true,
  },
});
