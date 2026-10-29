import {defineConfig} from 'vite';

export default defineConfig({
  base:'./',
  publicDir:false,
  build:{
    outDir:'../EsportsClash.Api/public/base-inspector',
    emptyOutDir:true,
    lib:{entry:'src/baseInspection.ts',formats:['es'],fileName:'base-inspector'},
    minify:true,
  },
});
