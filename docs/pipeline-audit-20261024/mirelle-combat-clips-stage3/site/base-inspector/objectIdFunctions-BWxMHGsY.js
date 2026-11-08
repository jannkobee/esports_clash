import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/objectIdFunctions.js
var t = "objectIdFunctions", n = "highp vec4 encodeObjectId(highp float objectId) {\n#ifdef PREPASS_OBJECT_ID_R8\nreturn vec4(objectId/255.0,0.0,0.0,1.0);\n#else\nhighp float id=floor(objectId);highp vec3 encodedId=vec3(\nfloor(mod(id,16777216.0)/65536.0),\nfloor(mod(id,65536.0)/256.0),\nmod(id,256.0)\n)/255.0;return vec4(encodedId,step(0.5,id));\n#endif\n}\n";
e.IncludesShadersStore[t] || (e.IncludesShadersStore[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
