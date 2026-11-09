import { t as e } from "./shaderStore-CXjvw9c2.js";
import "./objectIdFunctions-JHGeI95P.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/prePassDeclaration.js
var t = "prePassDeclaration", n = "#ifdef PREPASS\n#ifndef PREPASS_CUSTOM_VARYINGS\n#ifdef PREPASS_LOCAL_POSITION\nvarying vPosition : vec3f;\n#endif\n#ifdef PREPASS_DEPTH\nvarying vViewPos: vec3f;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nvarying vNormViewDepth: f32;\n#endif\n#if (defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)) && !defined(PREPASS_VELOCITY_ZERO)\nvarying vCurrentPosition: vec4f;varying vPreviousPosition: vec4f;\n#endif\n#endif\n#ifdef PREPASS_OBJECT_ID\nuniform objectId: f32;\n#include<objectIdFunctions>\n#endif\n#ifdef PREPASS_MESH_BLEND_TAG\nuniform meshBlendTag: i32;\n#endif\n#endif\n";
e.IncludesShadersStoreWGSL[t] || (e.IncludesShadersStoreWGSL[t] = n);
var r = {
	name: t,
	shader: n
}, i = "logDepthFragment", a = "#ifdef LOGARITHMICDEPTH\nfragmentOutputs.fragDepth=log2(fragmentInputs.vFragmentDepth)*uniforms.logarithmicDepthConstant*0.5;\n#endif\n";
e.IncludesShadersStoreWGSL[i] || (e.IncludesShadersStoreWGSL[i] = a);
var o = {
	name: i,
	shader: a
}, s = "meshBlendTagFragmentOutput", c = "#if SCENE_MRT_COUNT>{X}\n#if defined(PREPASS_MESH_BLEND_TAG) && PREPASS_MESH_BLEND_TAG_INDEX=={X}\nfragmentOutputs.fragData{X}=meshBlendTagOutput;\n#else\nfragmentOutputs.fragData{X}=fragData[{X}];\n#endif\n#endif\n";
e.IncludesShadersStoreWGSL[s] || (e.IncludesShadersStoreWGSL[s] = c);
var l = {
	name: s,
	shader: c
};
//#endregion
export { o as n, r, l as t };
