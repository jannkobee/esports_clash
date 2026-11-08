import { t as e } from "./shaderStore-CXjvw9c2.js";
import { t } from "./helperFunctions-CxnQE4lK.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/rgbdEncode.fragment.js
var n = "rgbdEncodePixelShader", r = "varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;\n#include<helperFunctions>\n#define CUSTOM_FRAGMENT_DEFINITIONS\n@fragment\nfn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=toRGBD(textureSample(textureSampler,textureSamplerSampler,input.vUV).rgb);}";
e.ShadersStoreWGSL[n] || (e.ShadersStoreWGSL[n] = r);
var i = [t];
for (let t of i) e.IncludesShadersStoreWGSL[t.name] || (e.IncludesShadersStoreWGSL[t.name] = t.shader);
//#endregion
