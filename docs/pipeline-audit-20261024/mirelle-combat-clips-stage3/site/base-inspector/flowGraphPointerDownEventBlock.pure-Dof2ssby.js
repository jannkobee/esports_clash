import { n as e } from "./typeStore-pENEWnX2.js";
import { a as t } from "./utils-Cc6lHVNn.js";
import { t as n } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { c as r, n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphPointerDownEventBlock.pure.js
var a = class extends n {
	constructor(e) {
		super(e), this.type = "PointerDown", this.targetMesh = this.registerDataInput("targetMesh", i, e?.targetMesh), this.pointerId = this.registerDataOutput("pointerId", r), this.pickedMesh = this.registerDataOutput("pickedMesh", i), this.pickedPoint = this.registerDataOutput("pickedPoint", i);
	}
	_executeEvent(e, n) {
		let r = this.targetMesh.getValue(e), i = n.pickInfo?.pickedMesh;
		return r && !(i === r || i && t(i, r)) ? !0 : (this.pointerId.setValue(n.event.pointerId, e), this.pickedMesh.setValue(i ?? null, e), this.pickedPoint.setValue(n.pickInfo?.pickedPoint ?? null, e), this._execute(e), !this.config?.stopPropagation);
	}
	_preparePendingTasks(e) {}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphPointerDownEventBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphPointerDownEventBlock", a));
}
//#endregion
export { a as FlowGraphPointerDownEventBlock, s as RegisterFlowGraphPointerDownEventBlock };
