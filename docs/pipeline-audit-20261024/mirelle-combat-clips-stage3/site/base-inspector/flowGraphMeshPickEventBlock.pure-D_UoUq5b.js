import { u as e } from "./math.color.pure-CPmbqLkh.js";
import { n as t } from "./typeStore-pENEWnX2.js";
import { t as n } from "./pointerEvents-BQVevekB.js";
import { a as r } from "./utils-Cc6lHVNn.js";
import { t as i } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { c as a, f as o, n as s } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphMeshPickEventBlock.pure.js
var c = class extends i {
	constructor(t) {
		super(t), this.config = t, this.type = "MeshPick";
		let r = t?.useNaNDefaults ? new e(NaN, NaN, NaN) : void 0;
		this.asset = this.registerDataInput("asset", s, t?.targetMesh), this.pickedPoint = this.registerDataOutput("pickedPoint", o, r), this.pickOrigin = this.registerDataOutput("pickOrigin", o, r), this.pointerId = this.registerDataOutput("pointerId", a, t?.pointerIdDefault), this.pickedMesh = this.registerDataOutput("pickedMesh", s), this.pointerType = this.registerDataInput("pointerType", s, n.POINTERPICK);
	}
	_getReferencedMesh(e) {
		return this.asset.getValue(e);
	}
	_executeEvent(e, t) {
		if (this.pointerType.getValue(e) !== t.type) return !0;
		let n = this._getReferencedMesh(e), i = t.pickInfo?.pickedMesh;
		return (n ? i && (i === n || r(i, n)) : i) && i ? (this.pointerId.setValue(t.event.pointerId, e), this.pickOrigin.setValue(t.pickInfo.ray?.origin, e), this.pickedPoint.setValue(t.pickInfo.pickedPoint, e), this.pickedMesh.setValue(i, e), this._execute(e), !this.config?.stopPropagation) : (this.pointerId.resetToDefaultValue(e), this.pickOrigin.resetToDefaultValue(e), this.pickedPoint.resetToDefaultValue(e), this.pickedMesh.resetToDefaultValue(e), !0);
	}
	_preparePendingTasks(e) {}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphMeshPickEventBlock";
	}
}, l = !1;
function u() {
	l || (l = !0, t("FlowGraphMeshPickEventBlock", c));
}
//#endregion
export { c as FlowGraphMeshPickEventBlock, u as RegisterFlowGraphMeshPickEventBlock };
