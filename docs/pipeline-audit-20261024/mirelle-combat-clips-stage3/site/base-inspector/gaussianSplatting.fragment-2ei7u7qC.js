import { t as e } from "./shaderStore-CXjvw9c2.js";
import { n as t, t as n } from "./clipPlaneFragment-CA1pANeG.js";
import { n as r, t as i } from "./fogFragment-BdqHgpGF.js";
import { t as a } from "./objectIdFunctions-JHGeI95P.js";
import { n as o, r as s, t as c } from "./meshBlendTagFragmentOutput-fvkZaw5p.js";
import { t as l } from "./logDepthDeclaration-pFd8QGRi.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/packingFunctions.js
var u = "packingFunctions", d = "fn pack(depth: f32)->vec4f\n{const bit_shift: vec4f= vec4f(255.0*255.0*255.0,255.0*255.0,255.0,1.0);const bit_mask: vec4f= vec4f(0.0,1.0/255.0,1.0/255.0,1.0/255.0);var res: vec4f=fract(depth*bit_shift);res-=res.xxyz*bit_mask;return res;}\nfn unpack(color: vec4f)->f32\n{const bit_shift: vec4f= vec4f(1.0/(255.0*255.0*255.0),1.0/(255.0*255.0),1.0/255.0,1.0);return dot(color,bit_shift);}";
e.IncludesShadersStoreWGSL[u] || (e.IncludesShadersStoreWGSL[u] = d);
var f = {
	name: u,
	shader: d
}, p = "gaussianSplattingFragmentDeclaration", m = "fn gaussianColor(inColor: vec4f,inPosition: vec2f)->vec4f\n{var A : f32=-dot(inPosition,inPosition);if (A>-4.0)\n{var B: f32=exp(A)*inColor.a;\n#include<logDepthFragment>\nvar color: vec4f=vec4f(inColor.rgb,B);\n#ifdef FOG\n#include<fogFragment>\n#endif\nreturn color;} else {return vec4f(0.0);}}\n";
e.IncludesShadersStoreWGSL[p] || (e.IncludesShadersStoreWGSL[p] = m);
var h = {
	name: p,
	shader: m
}, g = "geometryRenderingFragment", _ = "#ifdef PREPASS\n#if SCENE_MRT_COUNT>0\nlet geometryCoverage=select(0.0,1.0,geometryColor.a>0.4);var fragData: array<vec4f,SCENE_MRT_COUNT>;\n#ifdef PREPASS_COLOR\nfragData[PREPASS_COLOR_INDEX]=geometryColor;\n#endif\n#ifdef PREPASS_POSITION\nfragData[PREPASS_POSITION_INDEX]=vec4f(geometryPositionW,geometryCoverage);\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nfragData[PREPASS_LOCAL_POSITION_INDEX]=vec4f(geometryPositionL,geometryCoverage);\n#endif\n#ifdef PREPASS_DEPTH\nfragData[PREPASS_DEPTH_INDEX]=vec4f(geometryViewDepth,0.0,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nfragData[PREPASS_NORMALIZED_VIEW_DEPTH_INDEX]=vec4f(geometryNormalizedViewDepth,0.0,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_SCREENSPACE_DEPTH\nfragData[PREPASS_SCREENSPACE_DEPTH_INDEX]=vec4f(fragmentInputs.position.z,0.0,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_NORMAL\nfragData[PREPASS_NORMAL_INDEX]=vec4f(geometryNormalV,geometryCoverage);\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nfragData[PREPASS_WORLD_NORMAL_INDEX]=vec4f(geometryNormalW*0.5+0.5,geometryCoverage);\n#endif\n#ifdef PREPASS_ALBEDO\nfragData[PREPASS_ALBEDO_INDEX]=vec4f(geometryAlbedo,geometryCoverage);\n#endif\n#ifdef PREPASS_ALBEDO_SQRT\nfragData[PREPASS_ALBEDO_SQRT_INDEX]=vec4f(sqrt(max(geometryAlbedo,vec3f(0.0))),geometryCoverage);\n#endif\n#ifdef PREPASS_REFLECTIVITY\nfragData[PREPASS_REFLECTIVITY_INDEX]=vec4f(0.0,0.0,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_IRRADIANCE\nfragData[PREPASS_IRRADIANCE_INDEX]=vec4f(0.0,0.0,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_IRRADIANCE_LEGACY\nfragData[PREPASS_IRRADIANCE_LEGACY_INDEX]=vec4f(0.0);\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\n#ifdef PREPASS_VELOCITY_ZERO\nlet geometryMotion=vec2f(0.0);\n#else\nlet geometryMotion=0.5*(geometryCurrentPosition.xy/geometryCurrentPosition.w-geometryPreviousPosition.xy/geometryPreviousPosition.w);\n#endif\n#ifdef PREPASS_VELOCITY\nfragData[PREPASS_VELOCITY_INDEX]=vec4f(pow(abs(geometryMotion),vec2f(1.0/3.0))*sign(geometryMotion)*0.5+0.5,0.0,geometryCoverage);\n#endif\n#ifdef PREPASS_VELOCITY_LINEAR\nfragData[PREPASS_VELOCITY_LINEAR_INDEX]=vec4f(-geometryMotion,0.0,geometryCoverage);\n#endif\n#endif\n#ifdef PREPASS_OBJECT_ID\nfragData[PREPASS_OBJECT_ID_INDEX]=encodeObjectId(uniforms.objectId)*geometryCoverage;\n#endif\n#ifdef PREPASS_MESH_BLEND_TAG\nvar meshBlendTagOutput: vec4<u32>=vec4u(0u);if (geometryCoverage>0.0) {meshBlendTagOutput=vec4u(u32(uniforms.meshBlendTag),0u,0u,0u);}\n#endif\n#include<meshBlendTagFragmentOutput>[0..8]\n#endif\n#endif\n";
e.IncludesShadersStoreWGSL[g] || (e.IncludesShadersStoreWGSL[g] = _);
var v = {
	name: g,
	shader: _
}, y = "gaussianSplattingPixelShader", b = "#include<clipPlaneFragmentDeclaration>\n#include<logDepthDeclaration>\n#include<fogFragmentDeclaration>\n#define PREPASS_CUSTOM_VARYINGS\n#include<prePassDeclaration>[SCENE_MRT_COUNT]\n#ifdef GPUPICKER_PACK_DEPTH\n#include<packingFunctions>\n#endif\nvarying vColor: vec4f;varying vPosition: vec2f;\n#ifdef PREPASS\nuniform geometryZeroAlphaDiscard: f32;\n#ifdef PREPASS_POSITION\nvarying vGeometryPositionW: vec3f;\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nvarying vGeometryPositionL: vec3f;\n#endif\n#ifdef PREPASS_DEPTH\nvarying vGeometryViewDepth: f32;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nvarying vGeometryNormalizedViewDepth: f32;\n#endif\n#ifdef PREPASS_NORMAL\nvarying vGeometryNormalV: vec3f;\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nvarying vGeometryNormalW: vec3f;\n#endif\n#if defined(PREPASS_ALBEDO) || defined(PREPASS_ALBEDO_SQRT)\nvarying vGeometryAlbedo: vec3f;\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\nvarying vGeometryCurrentPosition: vec4f;varying vGeometryPreviousPosition: vec4f;\n#endif\n#endif\n#define CUSTOM_FRAGMENT_DEFINITIONS\n#include<gaussianSplattingFragmentDeclaration>\n@fragment\nfn main(input: FragmentInputs)->FragmentOutputs {\n#define CUSTOM_FRAGMENT_MAIN_BEGIN\n#include<clipPlaneFragment>\nvar finalColor: vec4f=gaussianColor(input.vColor,input.vPosition);\n#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR\n#ifdef PREPASS\nif (finalColor.a<=0.0 && uniforms.geometryZeroAlphaDiscard>0.0) {discard;}\nlet geometryColor=finalColor;\n#if defined(PREPASS_ALBEDO) || defined(PREPASS_ALBEDO_SQRT)\nlet geometryAlbedo=input.vGeometryAlbedo;\n#endif\n#ifdef PREPASS_POSITION\nlet geometryPositionW=input.vGeometryPositionW;\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nlet geometryPositionL=input.vGeometryPositionL;\n#endif\n#ifdef PREPASS_DEPTH\nlet geometryViewDepth=input.vGeometryViewDepth;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nlet geometryNormalizedViewDepth=input.vGeometryNormalizedViewDepth;\n#endif\n#ifdef PREPASS_NORMAL\nlet geometryNormalV=input.vGeometryNormalV;\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nlet geometryNormalW=input.vGeometryNormalW;\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\nlet geometryCurrentPosition=input.vGeometryCurrentPosition;let geometryPreviousPosition=input.vGeometryPreviousPosition;\n#endif\n#include<geometryRenderingFragment>\n#elif defined(GPUPICKER_DEPTH)\nfragmentOutputs.fragData0=finalColor;\n#ifdef GPUPICKER_PACK_DEPTH\nfragmentOutputs.fragData1=pack(fragmentInputs.position.z);\n#else\nfragmentOutputs.fragData1=vec4f(fragmentInputs.position.z,0.0,0.0,1.0);\n#endif\n#else\nfragmentOutputs.color=finalColor;\n#endif\n#define CUSTOM_FRAGMENT_MAIN_END\n}\n";
e.ShadersStoreWGSL[y] || (e.ShadersStoreWGSL[y] = b);
var x = [
	t,
	l,
	r,
	a,
	s,
	f,
	o,
	i,
	h,
	n,
	c,
	v
];
for (let t of x) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
var S = {
	name: y,
	shader: b
};
//#endregion
export { S as gaussianSplattingPixelShaderWGSL };
