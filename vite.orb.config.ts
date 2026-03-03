import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/vis/orb',
  build: {
    outDir: '../../../dist-orb',
    emptyOutDir: true,
  },
});
