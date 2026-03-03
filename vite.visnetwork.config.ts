import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/visnetwork',
  build: {
    outDir: '../../../dist-visnetwork',
    emptyOutDir: true,
  },
});
