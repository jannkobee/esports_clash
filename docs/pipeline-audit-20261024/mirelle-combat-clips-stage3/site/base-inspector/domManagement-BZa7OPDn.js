//#region node_modules/@babylonjs/core/Misc/domManagement.js
function e() {
	return typeof window < "u";
}
function t() {
	return typeof navigator < "u";
}
function n() {
	return typeof document < "u";
}
function r(e) {
	let t = "", n = e.firstChild;
	for (; n;) n.nodeType === 3 && (t += n.textContent), n = n.nextSibling;
	return t;
}
//#endregion
export { e as i, n, t as r, r as t };
