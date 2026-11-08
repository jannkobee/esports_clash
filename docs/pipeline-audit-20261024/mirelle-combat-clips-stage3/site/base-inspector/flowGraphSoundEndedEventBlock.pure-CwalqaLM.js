import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSoundEndedEventBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.sound = this.registerDataInput("sound", n);
	}
	_preparePendingTasks(e) {
		let t = this.sound.getValue(e);
		if (!t) {
			this._reportError(e, "No sound provided for sound-ended event");
			return;
		}
		let n = t.onEndedObservable.add(() => {
			this._execute(e);
		});
		e._setExecutionVariable(this, "_soundEndedObserver", n), e._setExecutionVariable(this, "_subscribedSound", t);
	}
	_executeEvent(e, t) {
		return !0;
	}
	_cancelPendingTasks(e) {
		let t = e._getExecutionVariable(this, "_soundEndedObserver", null), n = e._getExecutionVariable(this, "_subscribedSound", null);
		t && n && n.onEndedObservable.remove(t), e._setExecutionVariable(this, "_soundEndedObserver", null), e._setExecutionVariable(this, "_subscribedSound", null);
	}
	getClassName() {
		return "FlowGraphSoundEndedEventBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphSoundEndedEventBlock", r));
}
//#endregion
export { r as FlowGraphSoundEndedEventBlock, a as RegisterFlowGraphSoundEndedEventBlock };
