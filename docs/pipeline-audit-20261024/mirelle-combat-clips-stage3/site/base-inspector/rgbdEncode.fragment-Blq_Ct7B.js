import { t as e } from "./shaderStore-CXjvw9c2.js";
import { t } from "./helperFunctions-DT2snLI9.js";
//#region node_modules/@babylonjs/core/Shaders/rgbdEncode.fragment.js
var n = "rgbdEncodePixelShader", r = "varying vec2 vUV;uniform sampler2D textureSampler;\n#include<helperFunctions>\n#define CUSTOM_FRAGMENT_DEFINITIONS\nvoid main(void) \n{gl_FragColor=toRGBD(texture2D(textureSampler,vUV).rgb);}";
e.ShadersStore[n] || (e.ShadersStore[n] = r);
var i = [t];
for (let t of i) e.IncludesShadersStore[t.name] || (e.IncludesShadersStore[t.name] = t.shader);
//#endregion
