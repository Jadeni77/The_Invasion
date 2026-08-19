import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
/* Changes on every build, and is the only thing a running tab compares itself
   against to notice a deployment has happened. */
const BUILD_ID = new Date().toISOString();

/*
 * Writes the build's identity where a running tab can fetch it.
 *
 * It cannot live in public/ - that is copied verbatim and has no way to know
 * what build it is part of. Emitting it here is what ties the file to the
 * bundle that shipped beside it.
 */
function emitBuildId() {
  return {
    name: 'emit-build-id',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), emitBuildId()],

  /* The same value the running bundle carries, so it can tell its own build
     from the one now being served. */
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  // Without this, esbuild's minifier renames classes in production builds
  // (e.g. `Mortar` -> `Ef`), so `constructor.name` no longer matches the
  // class-name strings soundKeyFor (SoundGroups.js) compares against, and
  // every unit silently falls back to a generic sound. Tests never catch
  // this because they run unminified.
  esbuild: {
    keepNames: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
  },
})
