import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base relativa: el sitio funciona en GitHub Pages bajo /forma-pro/ y en local.
export default defineConfig({
  plugins: [react()],
  base: './',
});
