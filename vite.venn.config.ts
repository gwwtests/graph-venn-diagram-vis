import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/venn',
  build: { outDir: '../../../dist-venn', emptyOutDir: true },
});
