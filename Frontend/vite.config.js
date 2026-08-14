import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Without this, esbuild's minifier renames classes in production builds
  // (e.g. `Mortar` -> `Ef`), so `constructor.name` no longer matches the keys
  // in UNIT_VOICES and every per-unit voice silently falls back to the
  // generic sound. Tests never catch this because they run unminified.
  esbuild: {
    keepNames: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
  },
})
