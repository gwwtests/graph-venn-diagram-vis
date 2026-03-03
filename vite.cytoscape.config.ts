import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/cytoscape',
  build: {
    outDir: '../../../dist-cytoscape',
    emptyOutDir: true,
  },
});
