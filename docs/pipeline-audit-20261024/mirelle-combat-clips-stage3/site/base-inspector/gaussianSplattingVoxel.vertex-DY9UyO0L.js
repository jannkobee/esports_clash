import { t as e } from "./shaderStore-CXjvw9c2.js";
import { t } from "./sceneUboDeclaration-B3MfOmqR.js";
import { t as n } from "./meshUboDeclaration-CRyLH5bC.js";
import { n as r, t as i } from "./gaussianSplatting-BHAjuNu8.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/gaussianSplattingVoxel.vertex.js
var a = "gaussianSplattingVoxelVertexShader", o = "#include<sceneUboDeclaration>\n#include<meshUboDeclaration>\nattribute splatIndex0: vec4f;attribute splatIndex1: vec4f;attribute splatIndex2: vec4f;attribute splatIndex3: vec4f;attribute position: vec3f;uniform dataTextureSize: vec2f;uniform alpha: f32;uniform invWorldScale: mat4x4f;uniform viewMatrix: mat4x4f;\n#if IS_COMPOUND\nuniform partWorld: array<mat4x4<f32>,MAX_PART_COUNT>;uniform partVisibility: array<f32,MAX_PART_COUNT>;\n#endif\nvar rotationsATexture: texture_2d<f32>;var rotationsBTexture: texture_2d<f32>;var rotationScaleTexture: texture_2d<f32>;var centersTexture: texture_2d<f32>;var colorsTexture: texture_2d<f32>;\n#if IS_COMPOUND\nvar partIndicesTexture: texture_2d<f32>;\n#endif\nvarying vNormalizedPosition: vec3f;varying vNormalizedCenterPosition: vec3f;varying vAlpha: f32;varying vPatchPosition: vec2f;\n#include<gaussianSplatting>\n@vertex\nfn main(input: VertexInputs)->FragmentInputs {let splatIndex: f32=getSplatIndex(\ni32(vertexInputs.position.z+0.5),\nvertexInputs.splatIndex0,vertexInputs.splatIndex1,\nvertexInputs.splatIndex2,vertexInputs.splatIndex3\n);var splat: Splat=readSplat(splatIndex,uniforms.dataTextureSize);\n#if IS_COMPOUND\nif (uniforms.partVisibility[splat.partIndex]==0.0) {vertexOutputs.position=vec4f(2.0,2.0,2.0,1.0);return vertexOutputs;}\nlet splatWorld: mat4x4f=getPartWorld(splat.partIndex);\n#else\nlet splatWorld: mat4x4f=mesh.world;\n#endif\nlet quadPos: vec2f=vertexInputs.position.xy;let worldPos: vec4f=computeVoxelSplatWorldPos(splat.rotationA,splat.rotationB,splat.rotationScale,splat.center.xyz,splatWorld,uniforms.viewMatrix,uniforms.invWorldScale,quadPos);vertexOutputs.vNormalizedPosition=(uniforms.invWorldScale*worldPos).xyz*0.5+0.5;let clipPos: vec4f=uniforms.viewMatrix*uniforms.invWorldScale*worldPos;vertexOutputs.position=vec4f(clipPos.x,clipPos.y,clipPos.z*0.5+0.5,1.0);vertexOutputs.vNormalizedCenterPosition=(uniforms.invWorldScale*splatWorld*vec4f(splat.center.xyz,1.0)).xyz*0.5+0.5;vertexOutputs.vAlpha=splat.color.w*uniforms.alpha;\n#if IS_COMPOUND\nvertexOutputs.vAlpha*=uniforms.partVisibility[splat.partIndex];\n#endif\nvertexOutputs.vPatchPosition=quadPos;}\n";
e.ShadersStoreWGSL[a] || (e.ShadersStoreWGSL[a] = o);
var s = [
	t,
	n,
	r,
	i
];
for (let t of s) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
var c = {
	name: a,
	shader: o
};
//#endregion
export { c as gaussianSplattingVoxelVertexShaderWGSL };
