import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/fogVertexDeclaration.js
var t = "fogVertexDeclaration", n = "#ifdef FOG\nvarying vFogDistance: vec3f;\n#endif\n";
e.IncludesShadersStoreWGSL[t] || (e.IncludesShadersStoreWGSL[t] = n);
var r = {
	name: t,
	shader: n
}, i = "fogVertex", a = "#ifdef FOG\n#ifdef SCENE_UBO\nvertexOutputs.vFogDistance=(scene.view*worldPos).xyz;\n#else\nvertexOutputs.vFogDistance=(uniforms.view*worldPos).xyz;\n#endif\n#endif\n";
e.IncludesShadersStoreWGSL[i] || (e.IncludesShadersStoreWGSL[i] = a);
var o = {
	name: i,
	shader: a
};
//#endregion
export { r as n, o as t };
