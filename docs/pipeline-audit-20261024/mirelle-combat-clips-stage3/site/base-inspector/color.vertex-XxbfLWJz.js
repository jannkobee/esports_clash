import { t as e } from "./shaderStore-CXjvw9c2.js";
import { a as t, i as n, n as r, o as i, r as a, t as o } from "./bakedVertexAnimation-CTAS4V5L.js";
import { n as s, t as c } from "./clipPlaneVertex-CoylEQdx.js";
import { n as l, t as u } from "./fogVertex-CBEX5HhZ.js";
import { t as d } from "./vertexColorMixing-DPIk1na8.js";
//#region node_modules/@babylonjs/core/Shaders/color.vertex.js
var f = "colorVertexShader", p = "attribute vec3 position;\n#ifdef VERTEXCOLOR\nattribute vec4 color;\n#endif\n#include<bonesDeclaration>\n#include<bakedVertexAnimationDeclaration>\n#include<clipPlaneVertexDeclaration>\n#include<fogVertexDeclaration>\n#ifdef FOG\nuniform mat4 view;\n#endif\n#include<instancesDeclaration>\nuniform mat4 viewProjection;\n#ifdef MULTIVIEW\nuniform mat4 viewProjectionR;\n#endif\n#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)\nvarying vec4 vColor;\n#endif\n#define CUSTOM_VERTEX_DEFINITIONS\nvoid main(void) {\n#define CUSTOM_VERTEX_MAIN_BEGIN\n#ifdef VERTEXCOLOR\nvec4 colorUpdated=color;\n#endif\n#include<instancesVertex>\n#include<bonesVertex>\n#include<bakedVertexAnimation>\nvec4 worldPos=finalWorld*vec4(position,1.0);\n#ifdef MULTIVIEW\nif (gl_ViewID_OVR==0u) {gl_Position=viewProjection*worldPos;} else {gl_Position=viewProjectionR*worldPos;}\n#else\ngl_Position=viewProjection*worldPos;\n#endif\n#include<clipPlaneVertex>\n#include<fogVertex>\n#include<vertexColorMixing>\n#define CUSTOM_VERTEX_MAIN_END\n}";
e.ShadersStore[f] || (e.ShadersStore[f] = p);
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
for (let t of m) e.IncludesShadersStore[t.name] || (e.IncludesShadersStore[t.name] = t.shader);
var h = {
	name: f,
	shader: p
};
//#endregion
export { h as colorVertexShader };
