import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { s as n } from "./utils-Cc6lHVNn.js";
import { i as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { r as i } from "./flowGraphDelayRegistry-DO7wtljZ.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphCancelDelayBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.delayIndex = this.registerDataInput("delayIndex", r);
	}
	_execute(e, t) {
		let r = n(this.delayIndex.getValue(e));
		if (r < 0 || isNaN(r) || !isFinite(r)) {
			if (this.config?.ignoreInvalidDelay) {
				this.out._activateSignal(e);
				return;
			}
			return this._reportError(e, "Invalid delay index");
		}
		let a = e._getGlobalContextVariable("pendingDelays", []), o = a[r];
		o && (o.dispose(), delete a[r], e._setGlobalContextVariable("pendingDelays", a)), i(e, r), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphCancelDelayBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphCancelDelayBlock", a));
}
//#endregion
export { a as FlowGraphCancelDelayBlock, s as RegisterFlowGraphCancelDelayBlock };
