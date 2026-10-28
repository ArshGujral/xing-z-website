import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative URLs, so the build works from any subfolder (GitHub Pages serves it at /<repo-name>/).
  base: './',
  // The app's session folder is a virtualized path on Windows; don't follow it.
  resolve: { preserveSymlinks: true },
  // Three pages: the home page, the 3D configurator, and the admin panel for the catalogue.
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        configurator: resolve(__dirname, 'configurator.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
