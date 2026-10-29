import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One loading screen for every page, inlined so it shows before the bundle arrives.
const loader = {
  name: 'xingz-loader',
  transformIndexHtml: (html) =>
    html.replace(/<body([^>]*)>/, (body) => body + '\n' + readFileSync(resolve(__dirname, 'src/loader/loader.html'), 'utf8')),
}

export default defineConfig({
  plugins: [react(), loader],
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
