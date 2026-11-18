// Builds the match worker's engine into one ES module, so each match process starts without loading
// and type-stripping hundreds of TypeScript modules. Usage: node scripts/build-worker-engine.mjs [outfile]
import { rolldown } from 'rolldown';
import { resolve } from 'node:path';
const outfile = resolve(process.argv[2] ?? 'dist-worker/fps-engine.mjs');
const bundle = await rolldown({ input: resolve('src/fps/fpsWorkerEngine.ts'), platform: 'node', logLevel: 'warn' });
await bundle.write({ file: outfile, format: 'esm', minify: false, codeSplitting: false });
await bundle.close();
console.log(JSON.stringify({ built: outfile }));
