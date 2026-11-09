import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { f as n, n as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Physics/flowGraphApplyForceBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.body = this.registerDataInput("body", r), this.force = this.registerDataInput("force", n), this.location = this.registerDataInput("location", n);
	}
	_execute(e, t) {
		let n = this.body.getValue(e);
		if (!n) {
			this._reportError(e, "No physics body provided"), this.out._activateSignal(e);
			return;
		}
		let r = this.force.getValue(e), i = this.location.getValue(e);
		n.applyForce(r, i), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphApplyForceBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphApplyForceBlock", i));
}
//#endregion
export { i as FlowGraphApplyForceBlock, o as RegisterFlowGraphApplyForceBlock };
