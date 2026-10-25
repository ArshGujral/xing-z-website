import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative URLs, so the build works from any subfolder (GitHub Pages serves it at /<repo-name>/).
  base: './',
  // The app's session folder is a virtualized path on Windows; don't follow it.
  resolve: { preserveSymlinks: true },
})
