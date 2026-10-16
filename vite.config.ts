import { defineConfig } from 'vite';
import pkg from './package.json';

// Relative base so the build works at https://<user>.github.io/delve/
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
