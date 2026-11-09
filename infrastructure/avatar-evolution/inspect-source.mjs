// Read-only source inspection. A structural pass does not qualify anatomy/rigging.
import {readFile, writeFile} from 'node:fs/promises';
import validator from 'gltf-validator';
import {AvatarGLB, sha} from './glb.mjs';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw Error('Usage: node inspect-source.mjs source.glb report.json');
const bytes = await readFile(source), file = new AvatarGLB(bytes), json = file.json;
const gltf = await validator.validateBytes(new Uint8Array(bytes), {uri: 'source.glb', maxIssues: 200});
const problems = [], primitives = [];
for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
  const points = file.values(primitive.attributes.POSITION);
  const indices = primitive.indices === undefined ? points.map((_, i) => i) : file.values(primitive.indices).flat();
  const uvs = primitive.attributes.TEXCOORD_0 === undefined ? [] : file.values(primitive.attributes.TEXCOORD_0);
  const finitePositions = points.every(v => v.every(Number.isFinite));
  const validIndices = indices.every(i => Number.isInteger(i) && i >= 0 && i < points.length);
  const validUvs = uvs.length === points.length && uvs.every(v => v.length === 2 && v.every(Number.isFinite));
  const pbr = json.materials[primitive.material]?.pbrMetallicRoughness;
  if (!finitePositions || !validIndices || !validUvs || (primitive.mode ?? 4) !== 4) problems.push('Invalid position/index/UV/triangle data');
  if (!pbr?.baseColorTexture || !pbr?.metallicRoughnessTexture) problems.push('Missing base-color or metallic/roughness texture');
  primitives.push({vertices: points.length, triangles: indices.length / 3, finitePositions, validIndices, validUvs,
    uvMin: uvs.length ? [0, 1].map(c => uvs.reduce((v, uv) => Math.min(v, uv[c]), Infinity)) : null,
    uvMax: uvs.length ? [0, 1].map(c => uvs.reduce((v, uv) => Math.max(v, uv[c]), -Infinity)) : null});
}
const images = (json.images ?? []).map(image => {
  const view = json.bufferViews[image.bufferView], start = view.byteOffset ?? 0;
  const data = file.bin.subarray(start, start + view.byteLength);
  const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const dimensions = png ? [data.readUInt32BE(16), data.readUInt32BE(20)] : null;
  if (!dimensions || dimensions.some(n => n !== 1024)) problems.push('Texture is not a 1024x1024 PNG in this pinned profile');
  return {mimeType: image.mimeType, dimensions, bytes: data.length, sha256: sha(data)};
});
if (!images.length) problems.push('No embedded images');
if (gltf.issues.numErrors) problems.push('Khronos glTF validation errors');
const triangles = primitives.reduce((sum, p) => sum + p.triangles, 0);
if (triangles > 50000) problems.push('Source exceeds the existing 50000-face preparation gate');
const report = {source_sha256: sha(bytes), bytes: bytes.length, triangles, primitives, images,
  materials: json.materials, gltf: {validator: validator.version(), errors: gltf.issues.numErrors,
    warnings: gltf.issues.numWarnings, messages: gltf.issues.messages},
  structural_pass: !problems.length, problems, publication_eligible: false, visual_review_required: true,
  limitation: 'Anatomy, distinct limbs, T-pose, identity, skinning and motion require separate review.'};
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({sha256: report.source_sha256, triangles, errors: report.gltf.errors,
  warnings: report.gltf.warnings, structural_pass: report.structural_pass, problems}));
if (problems.length) process.exitCode = 1;
