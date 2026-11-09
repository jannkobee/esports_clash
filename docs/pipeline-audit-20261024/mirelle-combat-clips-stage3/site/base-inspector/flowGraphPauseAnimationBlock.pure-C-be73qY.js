import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Animation/flowGraphPauseAnimationBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.animationToPause = this.registerDataInput("animationToPause", n);
	}
	_execute(e) {
		this.animationToPause.getValue(e).pause(), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphPauseAnimationBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphPauseAnimationBlock", r));
}
//#endregion
export { r as FlowGraphPauseAnimationBlock, a as RegisterFlowGraphPauseAnimationBlock };
