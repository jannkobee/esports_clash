import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/bumpVertexDeclaration.js
var t = "bumpVertexDeclaration", n = "#if defined(BUMP) || defined(PARALLAX) || defined(CLEARCOAT_BUMP) || defined(ANISOTROPIC)\n#if defined(TANGENT) && defined(NORMAL) \nvarying mat3 vTBN;\n#endif\n#endif\n";
e.IncludesShadersStore[t] || (e.IncludesShadersStore[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
