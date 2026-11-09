import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/sceneUboDeclaration.js
var t = "sceneUboDeclaration", n = "layout(std140,column_major) uniform;uniform Scene {mat4 viewProjection;\n#ifdef MULTIVIEW\nmat4 viewProjectionR;\n#endif \nmat4 view;mat4 projection;vec4 vEyePosition;mat4 inverseProjection;};\n";
e.IncludesShadersStore[t] || (e.IncludesShadersStore[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
