import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphInteger.pure-DqL1vt3x.js";
import { t as n } from "./flowGraphBlock-BTSj91tT.js";
import { t as r } from "./flowGraphAssetsContext-6T_gO7Vp.js";
import { s as i } from "./utils-Cc6lHVNn.js";
import { n as a } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetAssetBlock.pure.js
var o = class extends n {
	constructor(e) {
		super(e), this.config = e, this.type = this.registerDataInput("type", a, e.type), this.value = this.registerDataOutput("value", a), this.index = this.registerDataInput("index", a, new t(i(e.index ?? -1)));
	}
	_updateOutputs(e) {
		let t = this.type.getValue(e), n = this.index.getValue(e), a = r(e.assetsContext, t, i(n), this.config.useIndexAsUniqueId);
		this.value.setValue(a, e);
	}
	getClassName() {
		return "FlowGraphGetAssetBlock";
	}
}, s = !1;
function c() {
	s || (s = !0, e("FlowGraphGetAssetBlock", o));
}
//#endregion
export { o as FlowGraphGetAssetBlock, c as RegisterFlowGraphGetAssetBlock };
