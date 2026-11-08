import { t as e } from "./shaderStore-CXjvw9c2.js";
import { a as t, i as n, n as r, o as i, r as a, t as o } from "./bakedVertexAnimation-sicjZYXb.js";
import { n as s, t as c } from "./clipPlaneVertex-CAu7ufCg.js";
import { n as l, t as u } from "./fogVertex-DOhtQxgb.js";
import { t as d } from "./vertexColorMixing-DahYPGR-.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/color.vertex.js
var f = "colorVertexShader", p = "attribute position: vec3f;\n#ifdef VERTEXCOLOR\nattribute color: vec4f;\n#endif\n#include<bonesDeclaration>\n#include<bakedVertexAnimationDeclaration>\n#include<clipPlaneVertexDeclaration>\n#include<fogVertexDeclaration>\n#ifdef FOG\nuniform view: mat4x4f;\n#endif\n#include<instancesDeclaration>\nuniform viewProjection: mat4x4f;\n#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)\nvarying vColor: vec4f;\n#endif\n#define CUSTOM_VERTEX_DEFINITIONS\n@vertex\nfn main(input : VertexInputs)->FragmentInputs {\n#define CUSTOM_VERTEX_MAIN_BEGIN\n#ifdef VERTEXCOLOR\nvar colorUpdated: vec4f=vertexInputs.color;\n#endif\n#include<instancesVertex>\n#include<bonesVertex>\n#include<bakedVertexAnimation>\nvar worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;\n#include<clipPlaneVertex>\n#include<fogVertex>\n#include<vertexColorMixing>\n#define CUSTOM_VERTEX_MAIN_END\n}";
e.ShadersStoreWGSL[f] || (e.ShadersStoreWGSL[f] = p);
var m = [
	i,
	t,
	s,
	l,
	n,
	a,
	r,
	o,
	c,
	u,
	d
];
for (let t of m) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
var h = {
	name: f,
	shader: p
};
//#endregion
export { h as colorVertexShaderWGSL };
