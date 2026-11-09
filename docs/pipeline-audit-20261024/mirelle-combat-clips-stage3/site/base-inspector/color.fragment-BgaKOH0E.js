import { t as e } from "./shaderStore-CXjvw9c2.js";
import { n as t, t as n } from "./clipPlaneFragment-CA1pANeG.js";
import { n as r, t as i } from "./fogFragment-BdqHgpGF.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/color.fragment.js
var a = "colorPixelShader", o = "#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)\n#define VERTEXCOLOR\nvarying vColor: vec4f;\n#else\nuniform color: vec4f;\n#endif\n#include<clipPlaneFragmentDeclaration>\n#include<fogFragmentDeclaration>\n#define CUSTOM_FRAGMENT_DEFINITIONS\n@fragment\nfn main(input: FragmentInputs)->FragmentOutputs {\n#define CUSTOM_FRAGMENT_MAIN_BEGIN\n#include<clipPlaneFragment>\n#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)\nfragmentOutputs.color=input.vColor;\n#else\nfragmentOutputs.color=uniforms.color;\n#endif\n#include<fogFragment>(color,fragmentOutputs.color)\n#define CUSTOM_FRAGMENT_MAIN_END\n}";
e.ShadersStoreWGSL[a] || (e.ShadersStoreWGSL[a] = o);
var s = [
	t,
	r,
	n,
	i
];
for (let t of s) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
var c = {
	name: a,
	shader: o
};
//#endregion
export { c as colorPixelShaderWGSL };
