import {readFile,writeFile} from 'node:fs/promises';
import crypto from 'node:crypto';
import validator from '../tools/node_modules/gltf-validator/index.js';
if(!process.env.COLAB_RELEASE_TAG)throw Error('Colab required');
const bytes = await readFile(new URL('./normal-corrected.glb', import.meta.url));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const result = await validator.validateBytes(new Uint8Array(bytes), { uri: 'normal-corrected.glb', maxIssues: 200 });
const report = {
  compute: 'google',
  sha256,
  publication_eligible: false,
  qualification_complete: false,
  validator_version: validator.version(),
  result,
};
await writeFile(new URL('./gltf-validation.json', import.meta.url), JSON.stringify(report, null, 2));
if (result.issues.numErrors) process.exitCode = 1;
