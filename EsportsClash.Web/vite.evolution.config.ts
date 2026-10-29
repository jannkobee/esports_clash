import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { intelligenceSourceHash } from './scripts/intelligence-source-hash.mjs';
export default defineConfig({ plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.INTELLIGENCE_SOURCE_HASH': JSON.stringify(intelligenceSourceHash()) },
  build: { outDir: 'evolution-dist', minify: false,
    rolldownOptions: { input: 'evolution-compiled.html', output: { minify: false } } } });
