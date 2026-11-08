import { n as e } from "./typeStore-pENEWnX2.js";
import { c as t, n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as r } from "./flowGraphCachedOperationBlock-BsIcMusH.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Audio/flowGraphGetSoundVolumeBlock.pure.js
var i = class extends r {
	constructor(e) {
		super(t, e), this.sound = this.registerDataInput("sound", n);
	}
	_doOperation(e) {
		let t = this.sound.getValue(e);
		if (t) return t.volume;
	}
	getClassName() {
		return "FlowGraphGetSoundVolumeBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphGetSoundVolumeBlock", i));
}
//#endregion
export { i as FlowGraphGetSoundVolumeBlock, o as RegisterFlowGraphGetSoundVolumeBlock };
