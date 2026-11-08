import { t as e } from "./flowGraphInteger.pure-DqL1vt3x.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as r } from "./interactivityReferences-CSTTOlb9.js";
//#region node_modules/@babylonjs/loaders/glTF/2.0/Extensions/KHR_interactivity/flowGraphDelayReferenceBlock.js
var i = class extends t {
	constructor(t) {
		super(t), this.config = t, this.input = this.registerDataInput("input", n), this.value = this.registerDataOutput("value", n, t.decode ? new e(-1) : "");
	}
	_updateOutputs(t) {
		let n = this.input.getValue(t);
		if (this.config.decode) {
			let i = -1;
			if (n instanceof e) i = n.value;
			else if (typeof n == "string" && n.startsWith("/extensions/KHR_interactivity/delays/")) {
				let e = n.substring(r.length);
				if (/^(0|[1-9]\d*)$/.test(e)) {
					let t = Number(e);
					Number.isSafeInteger(t) && t <= 2147483647 && (i = t);
				}
			}
			this.value.setValue(new e(i), t);
		} else {
			let i = n instanceof e ? n.value : -1;
			this.value.setValue(i < 0 ? "" : r + i, t);
		}
	}
	getClassName() {
		return "FlowGraphDelayReferenceBlock";
	}
};
//#endregion
export { i as FlowGraphDelayReferenceBlock };
