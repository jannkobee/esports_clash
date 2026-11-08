import { n as e } from "./typeStore-pENEWnX2.js";
import { r as t } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as n } from "./flowGraphKeyboardEventBlock-CwfShyZf.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphKeyDownEventBlock.pure.js
var r = class extends n {
	constructor(e) {
		super(e), this.type = "KeyDown", this.isRepeat = this.registerDataOutput("isRepeat", t);
	}
	_executeEvent(e, t) {
		let n = t.event.repeat ?? !1;
		return n && this.config?.ignoreRepeat ? !0 : (this.isRepeat.setValue(n, e), super._executeEvent(e, t));
	}
	getClassName() {
		return "FlowGraphKeyDownEventBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphKeyDownEventBlock", r));
}
//#endregion
export { r as FlowGraphKeyDownEventBlock, a as RegisterFlowGraphKeyDownEventBlock };
