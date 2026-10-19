// Run from repository root. Executes only the authored, trusted TypeScript item module.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const ts = require('../../EsportsClash.Web/node_modules/typescript');
const source = 'EsportsClash.Web/src/itemsData.ts';
const code = await readFile(source, 'utf8');
const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('exports', 'require', 'module', js)(module.exports, require, module);
const items = [...module.exports.ALL_ITEMS, module.exports.BOOTS];
await writeFile('EsportsClash.Api/resources/game/management-items.json', JSON.stringify({
    source, source_sha256: createHash('sha256').update(code).digest('hex'), items,
}, null, 2) + '\n');
console.log(`Exported ${items.length} authored items with current price transforms; no game catalog changes.`);
