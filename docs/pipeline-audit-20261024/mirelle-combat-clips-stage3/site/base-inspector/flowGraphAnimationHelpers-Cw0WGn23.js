//#region node_modules/@babylonjs/core/FlowGraph/flowGraphAnimationHelpers.js
function e(e, t) {
	let n = e._getGlobalContextVariable("animationGroupObserverSets", /* @__PURE__ */ new Map()), r = n.get(t.uniqueId);
	if (r) return t.onAnimationGroupEndObservable.remove(r.groupEnd), t.onAnimationEndObservable.remove(r.animationEnd), t.onAnimationLoopObservable.remove(r.animationLoop), t.onAnimationGroupLoopObservable.remove(r.groupLoop), n.delete(t.uniqueId), e._setGlobalContextVariable("animationGroupObserverSets", n), r.block;
}
//#endregion
export { e as t };
