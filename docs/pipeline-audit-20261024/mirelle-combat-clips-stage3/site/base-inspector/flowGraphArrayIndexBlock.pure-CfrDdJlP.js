import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphInteger.pure-DqL1vt3x.js";
import { t as n } from "./flowGraphBlock-BTSj91tT.js";
import { s as r } from "./utils-Cc6lHVNn.js";
import { n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphArrayIndexBlock.pure.js
var a = class extends n {
	constructor(e) {
		super(e), this.config = e, this.array = this.registerDataInput("array", i), this.index = this.registerDataInput("index", i, new t(-1)), this.value = this.registerDataOutput("value", i);
	}
	_updateOutputs(e) {
		let t = this.array.getValue(e), n = this.index.getValue(e);
		if (n == null) {
			this.value.setValue(null, e);
			return;
		}
		let i;
		if (typeof n == "string") {
			let t = e.decodeIndexReference(n, this.config.referenceCollection);
			if (t === void 0) {
				this.value.setValue(null, e);
				return;
			}
			i = t;
		} else i = r(n);
		t && i >= 0 && i < t.length ? this.value.setValue(t[i], e) : this.value.setValue(null, e);
	}
	serialize(e) {
		super.serialize(e);
	}
	getClassName() {
		return "FlowGraphArrayIndexBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphArrayIndexBlock", a));
}
//#endregion
export { a as FlowGraphArrayIndexBlock, s as RegisterFlowGraphArrayIndexBlock };
