import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { c as n, n as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphContextBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.userVariables = this.registerDataOutput("userVariables", r), this.executionId = this.registerDataOutput("executionId", n);
	}
	_updateOutputs(e) {
		this.userVariables.setValue(e.userVariables, e), this.executionId.setValue(e.executionId, e);
	}
	serialize(e) {
		super.serialize(e);
	}
	getClassName() {
		return "FlowGraphContextBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphContextBlock", i));
}
//#endregion
export { i as FlowGraphContextBlock, o as RegisterFlowGraphContextBlock };
