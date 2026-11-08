import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/objectIdFunctions.js
var t = "objectIdFunctions", n = "fn encodeObjectId(objectId: f32)->vec4f {\n#ifdef PREPASS_OBJECT_ID_R8\nreturn vec4f(objectId/255.0,0.0,0.0,1.0);\n#else\nlet id=i32(objectId);let encodedId=vec3f(\nf32((id>>16) & 0xFF),\nf32((id>>8) & 0xFF),\nf32(id & 0xFF)\n)/255.0;return vec4f(encodedId,select(0.0,1.0,id>0));\n#endif\n}\n";
e.IncludesShadersStoreWGSL[t] || (e.IncludesShadersStoreWGSL[t] = n);
var r = {
	name: t,
	shader: n
};
//#endregion
export { r as t };
