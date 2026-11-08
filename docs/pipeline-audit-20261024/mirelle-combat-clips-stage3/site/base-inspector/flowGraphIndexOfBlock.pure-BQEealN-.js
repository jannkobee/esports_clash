import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphInteger.pure-DqL1vt3x.js";
import { t as n } from "./flowGraphBlock-BTSj91tT.js";
import { i as r, n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphIndexOfBlock.pure.js
var a = class extends n {
	constructor(e) {
		super(e), this.config = e, this.object = this.registerDataInput("object", i), this.array = this.registerDataInput("array", i), this.index = this.registerDataOutput("index", r, new t(-1));
	}
	_updateOutputs(e) {
		let n = this.object.getValue(e), r = this.array.getValue(e);
		r && this.index.setValue(new t(r.indexOf(n)), e);
	}
	serialize(e) {
		super.serialize(e);
	}
	getClassName() {
		return "FlowGraphIndexOfBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphIndexOfBlock", a));
}
//#endregion
export { a as FlowGraphIndexOfBlock, s as RegisterFlowGraphIndexOfBlock };
