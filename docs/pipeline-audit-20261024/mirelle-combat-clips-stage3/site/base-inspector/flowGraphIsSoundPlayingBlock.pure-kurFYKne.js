import { n as e } from "./typeStore-pENEWnX2.js";
import { n as t, r as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as r } from "./flowGraphCachedOperationBlock-BsIcMusH.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Audio/flowGraphIsSoundPlayingBlock.pure.js
var i = class extends r {
	constructor(e) {
		super(n, e), this.sound = this.registerDataInput("sound", t);
	}
	_doOperation(e) {
		let t = this.sound.getValue(e);
		if (t) return t.state === 3 || t.state === 2;
	}
	getClassName() {
		return "FlowGraphIsSoundPlayingBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphIsSoundPlayingBlock", i));
}
//#endregion
export { i as FlowGraphIsSoundPlayingBlock, o as RegisterFlowGraphIsSoundPlayingBlock };
