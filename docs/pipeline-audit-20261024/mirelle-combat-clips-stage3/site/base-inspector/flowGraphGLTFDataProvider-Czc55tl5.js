import { t as e } from "./flowGraphBlock-BTSj91tT.js";
import { n as t } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import "./base-inspector.js";
//#region node_modules/@babylonjs/loaders/glTF/2.0/Extensions/KHR_interactivity/flowGraphGLTFDataProvider.js
var n = class extends e {
	constructor(e = {}) {
		super(e);
		let n = e.glTF, r = n?.animations?.map((e) => e._babylonAnimationGroup) || [];
		this.animationGroups = this.registerDataOutput("animationGroups", t, r);
		let i = n?.nodes?.map((e) => e._babylonTransformNode) || [];
		this.nodes = this.registerDataOutput("nodes", t, i);
	}
	getClassName() {
		return "FlowGraphGLTFDataProvider";
	}
};
//#endregion
export { n as FlowGraphGLTFDataProvider };
