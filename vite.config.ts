import { defineConfig } from 'vite';
import pkg from './package.json';

// Unique per build; the running app compares it with version.json to spot updates.
const BUILD_ID = Date.now().toString(36);

// Relative base so the build works at https://<user>.github.io/delve/
export default defineConfig({
  base: './',
  // admin.html is the owner's visitor log (src/admin), a second page next to the game.
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    {
      name: 'version-file',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD_ID }) });
      },
    },
  ],
});
