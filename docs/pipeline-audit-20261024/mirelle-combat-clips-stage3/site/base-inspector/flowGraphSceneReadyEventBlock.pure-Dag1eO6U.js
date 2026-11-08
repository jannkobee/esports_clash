import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { u as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSceneReadyEventBlock.pure.js
var r = "sceneReady", i = class extends t {
	get eventKey() {
		return r;
	}
	constructor() {
		super(), this.initPriority = -1, this.type = "SceneReady", this.eventRef = this.registerDataOutput("event", n);
	}
	_updateOutputs(e) {
		this.eventRef.setValue(e.getEventReference(r), e);
	}
	_executeEvent(e, t) {
		return this.eventRef.setValue(e.getEventReference(r), e), this._execute(e), !0;
	}
	_preparePendingTasks(e) {}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphSceneReadyEventBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphSceneReadyEventBlock", i));
}
//#endregion
export { i as FlowGraphSceneReadyEventBlock, o as RegisterFlowGraphSceneReadyEventBlock };
