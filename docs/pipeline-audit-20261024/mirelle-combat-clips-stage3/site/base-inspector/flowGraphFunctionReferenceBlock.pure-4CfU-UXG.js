import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { n, u as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphFunctionReferenceBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.functionName = this.registerDataInput("functionName", r), this.object = this.registerDataInput("object", n), this.context = this.registerDataInput("context", n, null), this.output = this.registerDataOutput("output", n);
	}
	_updateOutputs(e) {
		let t = this.functionName.getValue(e), n = this.object.getValue(e), r = this.context.getValue(e);
		if (n && t) {
			let i = n[t];
			i && typeof i == "function" && this.output.setValue(i.bind(r), e);
		}
	}
	getClassName() {
		return "FlowGraphFunctionReference";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphFunctionReference", i));
}
//#endregion
export { i as FlowGraphFunctionReferenceBlock, o as RegisterFlowGraphFunctionReferenceBlock };
