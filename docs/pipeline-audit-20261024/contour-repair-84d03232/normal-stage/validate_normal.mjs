import {readFile,writeFile} from 'node:fs/promises';
import crypto from 'node:crypto';
import validator from '../tools/node_modules/gltf-validator/index.js';
const p=process.argv[2],bytes=await readFile(p+'/normal-corrected.glb');
const result=await validator.validateBytes(new Uint8Array(bytes),{uri:'normal-corrected.glb',maxIssues:200});
await writeFile(p+'/gltf-validation.json',JSON.stringify({compute:'google',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),publication_eligible:false,qualification_complete:false,validator_version:validator.version(),result},null,2));
if(result.issues.numErrors)process.exitCode=1;
