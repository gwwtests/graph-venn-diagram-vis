import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/sigma',
  build: {
    outDir: '../../../dist-sigma',
    emptyOutDir: true,
  },
});
