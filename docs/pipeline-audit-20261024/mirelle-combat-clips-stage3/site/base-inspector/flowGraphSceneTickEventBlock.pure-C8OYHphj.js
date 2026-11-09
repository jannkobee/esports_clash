import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { c as n, u as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSceneTickEventBlock.pure.js
var i = "sceneTick", a = class extends t {
	get eventKey() {
		return i;
	}
	constructor(e) {
		super(e), this.type = "SceneBeforeRender", this.timeSinceStart = this.registerDataOutput("timeSinceStart", n, e?.useFirstTickAsStart ? NaN : 0), this.deltaTime = this.registerDataOutput("deltaTime", n, e?.useFirstTickAsStart ? NaN : 0), this.eventRef = this.registerDataOutput("event", r);
	}
	_updateOutputs(e) {
		this.eventRef.setValue(e.getEventReference(i), e);
	}
	_preparePendingTasks(e) {}
	_executeEvent(e, t) {
		if (this.config?.useFirstTickAsStart) {
			let n = e._getGlobalContextVariable("firstTickPayload", t);
			e._setGlobalContextVariable("firstTickPayload", n);
			let r = t.timeSinceStart - n.timeSinceStart + t.deltaTime - n.deltaTime;
			this.timeSinceStart.setValue(t === n ? 0 : r, e), this.deltaTime.setValue(t === n ? NaN : t.deltaTime, e);
		} else this.timeSinceStart.setValue(t.timeSinceStart, e), this.deltaTime.setValue(t.deltaTime, e);
		return this.eventRef.setValue(e.getEventReference(i), e), this._execute(e), !0;
	}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphSceneTickEventBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphSceneTickEventBlock", a));
}
//#endregion
export { a as FlowGraphSceneTickEventBlock, s as RegisterFlowGraphSceneTickEventBlock };
