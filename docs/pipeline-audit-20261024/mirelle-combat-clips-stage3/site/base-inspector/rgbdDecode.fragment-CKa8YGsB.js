import { t as e } from "./shaderStore-CXjvw9c2.js";
import { t } from "./helperFunctions-CxnQE4lK.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/rgbdDecode.fragment.js
var n = "rgbdDecodePixelShader", r = "varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;\n#include<helperFunctions>\n#define CUSTOM_FRAGMENT_DEFINITIONS\n@fragment\nfn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=vec4f(fromRGBD(textureSample(textureSampler,textureSamplerSampler,input.vUV)),1.0);}";
e.ShadersStoreWGSL[n] || (e.ShadersStoreWGSL[n] = r);
var i = [t];
for (let t of i) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
//#endregion
