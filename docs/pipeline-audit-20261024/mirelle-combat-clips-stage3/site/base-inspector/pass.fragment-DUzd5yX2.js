import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/pass.fragment.js
var t = "passPixelShader", n = "varying vec2 vUV;uniform sampler2D textureSampler;\n#define CUSTOM_FRAGMENT_DEFINITIONS\nvoid main(void) \n{gl_FragColor=texture2D(textureSampler,vUV);}";
e.ShadersStore[t] || (e.ShadersStore[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as passPixelShader };
