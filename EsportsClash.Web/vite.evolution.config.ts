import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.DEV': 'true' },
  build: { outDir: 'evolution-dist', minify: false,
    rolldownOptions: { input: 'evolution-compiled.html', output: { minify: false } } } });
