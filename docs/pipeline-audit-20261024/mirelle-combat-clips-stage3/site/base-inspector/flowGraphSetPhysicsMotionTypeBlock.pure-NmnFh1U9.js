import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { c as n, n as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Physics/flowGraphSetPhysicsMotionTypeBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.body = this.registerDataInput("body", r), this.motionType = this.registerDataInput("motionType", n, 2);
	}
	_execute(e, t) {
		let n = this.body.getValue(e);
		n ? (n.setMotionType(this.motionType.getValue(e)), this.out._activateSignal(e)) : (this._reportError(e, "No physics body provided"), this.out._activateSignal(e));
	}
	getClassName() {
		return "FlowGraphSetPhysicsMotionTypeBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphSetPhysicsMotionTypeBlock", i));
}
//#endregion
export { i as FlowGraphSetPhysicsMotionTypeBlock, o as RegisterFlowGraphSetPhysicsMotionTypeBlock };
