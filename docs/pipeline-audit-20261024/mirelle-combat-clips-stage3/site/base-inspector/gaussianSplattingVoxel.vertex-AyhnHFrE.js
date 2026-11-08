import { t as e } from "./shaderStore-CXjvw9c2.js";
import { t } from "./sceneUboDeclaration-B1dWgwNU.js";
import { t as n } from "./meshUboDeclaration-BwlcOBVb.js";
import { n as r, r as i, t as a } from "./gaussianSplatting-CYova0Wy.js";
//#region node_modules/@babylonjs/core/Shaders/gaussianSplattingVoxel.vertex.js
var o = "gaussianSplattingVoxelVertexShader", s = "#include<__decl__gaussianSplattingVertex>\nuniform vec2 dataTextureSize;uniform float alpha;uniform mat4 invWorldScale;uniform mat4 viewMatrix;uniform sampler2D rotationsATexture;uniform sampler2D rotationsBTexture;uniform sampler2D rotationScaleTexture;uniform sampler2D centersTexture;uniform sampler2D colorsTexture;\n#if IS_COMPOUND\nuniform mat4 partWorld[MAX_PART_COUNT];uniform float partVisibility[MAX_PART_COUNT];uniform sampler2D partIndicesTexture;\n#endif\nvarying vec3 vNormalizedPosition;varying vec3 vNormalizedCenterPosition;varying float vAlpha;varying vec2 vPatchPosition;\n#include<gaussianSplatting>\nvoid main(void) {float splatIndex=getSplatIndex(int(position.z+0.5));Splat splat=readSplat(splatIndex);\n#if IS_COMPOUND\nif (partVisibility[splat.partIndex]==0.0) {gl_Position=vec4(2.0,2.0,2.0,1.0);return;}\nmat4 splatWorld=getPartWorld(splat.partIndex);\n#else\nmat4 splatWorld=world;\n#endif\nvec4 worldPos=computeVoxelSplatWorldPos(splat.rotationA,splat.rotationB,splat.rotationScale,splat.center.xyz,splatWorld,viewMatrix,invWorldScale,position.xy);gl_Position=viewMatrix*invWorldScale*worldPos;vNormalizedPosition=gl_Position.xyz*0.5+0.5;vec4 viewCenterPos=viewMatrix*invWorldScale*splatWorld*vec4(splat.center.xyz,1.0);vNormalizedCenterPosition=viewCenterPos.xyz*0.5+0.5;vAlpha=splat.color.w*alpha;\n#if IS_COMPOUND\nvAlpha*=partVisibility[splat.partIndex];\n#endif\nvPatchPosition=position.xy;}";
e.ShadersStore[o] || (e.ShadersStore[o] = s);
var c = [
	i,
	t,
	n,
	r,
	a
];
for (let t of c) e.IncludesShadersStore[t.name] || (e.IncludesShadersStore[t.name] = t.shader);
var l = {
	name: o,
	shader: s
};
//#endregion
export { l as gaussianSplattingVoxelVertexShader };
