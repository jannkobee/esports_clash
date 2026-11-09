import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/logDepthDeclaration.js
var t = "logDepthDeclaration", n = "#ifdef LOGARITHMICDEPTH\nuniform float logarithmicDepthConstant;varying float vFragmentDepth;\n#endif\n";
e.IncludesShadersStore[t] || (e.IncludesShadersStore[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
