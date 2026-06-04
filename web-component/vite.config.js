import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/main.jsx',
      name: 'MirrorMundial',
      fileName: 'mirror-mundial',
      formats: ['es'],
    },
    rollupOptions: {
      // Todo bundleado — Shopify no tiene import map
    },
    cssCodeSplit: false,  // CSS en un solo chunk
    target: 'es2020',     // iOS Safari 14+ soporta es2020
    outDir: 'dist',
    emptyOutDir: true,
  },
})
