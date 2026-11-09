import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/meshUboDeclaration.js
var t = "meshUboDeclaration", n = "struct Mesh {world : mat4x4<f32>,\nvisibility : f32,};var<uniform> mesh : Mesh;\n#define WORLD_UBO\n";
e.IncludesShadersStoreWGSL[t] || (e.IncludesShadersStoreWGSL[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
