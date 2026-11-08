import {readFile,writeFile} from 'node:fs/promises';
import crypto from 'node:crypto';
import validator from 'gltf-validator';
if(!process.env.COLAB_RELEASE_TAG)throw Error('Colab required');
const root=process.argv[2],bytes=await readFile(root+'/contour-diagnostic.glb');
const result=await validator.validateBytes(new Uint8Array(bytes),{uri:'contour-diagnostic.glb',maxIssues:200});
await writeFile(root+'/gltf-validation.json',JSON.stringify({compute:'google',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),publication_eligible:false,qualification_complete:false,validator_version:validator.version(),result},null,2));
if(result.issues.numErrors)process.exitCode=1;
