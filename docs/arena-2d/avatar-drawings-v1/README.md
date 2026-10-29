# Fresh roster drawings

Owner request: restore the detailed arena and draw all avatars. Stage owner: `/root`; no delegated agents. Generated with the built-in imagegen tool under the approved painted illustration workflow, independently of the 3D base/rig pipeline.

Open `/art/avatar-drawings-v1/index.html` on the frontend, or open `EsportsClash.Web/public/art/avatar-drawings-v1/index.html` locally. Each card links to the original full-resolution PNG. The gallery can be searched by current avatar name.

`manifest.json` records actual coverage, stable IDs, canonical names, exact prompts, prompt hashes, image dimensions and SHA-256 hashes. Individual JSON receipts preserve the original generated-image paths. The source identity/design hashes are recorded once in the manifest. These are newly generated drawings; no deleted avatar binaries were recovered.

Review scope: static silhouette, visible equipment and companion identity. The set includes the one-tailed Mireth, Orin's horned dusk-hound, Droven's moss-backed pack tortoise, Mirelle's paper-pattern cape/brass bobbin, amphibian Odo, pangolin Murdle and both distinct simian designs. Historical conflicting anatomy records remain untouched.

These are static design drawings, not animation atlases or qualified live sprites. Some equipment reaches close to image borders, illustrated glow can remain in translucent pixels, and fine costume/face details require owner art review. Mirelle's footwear and sleeve interpretation still need stricter comparison with the brief before motion production. No eight-direction consistency, gait, pivots, cast timing, companion separation, transparent-edge quality or match-scale rendering qualification is claimed. Do not publish the PNGs as finished combat sprites automatically.

The existing live Mirelle sprite and all release records remain unchanged. Next stage after design review is separate layered, pivot-aligned sprite production with authored directions and character-specific motion; preserve these drawings and receipts as source versions.

Packaging: run `python scripts/build-avatar-drawing-gallery.py` from `EsportsClash.Web`. This computes metadata and creates the gallery without modifying image pixels. Browser verification: `node scripts/verify-avatar-drawings.mjs`, with `BABYLON_CHECK_URL` pointing to the frontend and isolated Chrome CDP on port 9238. Evidence is saved alongside this document.

Completed coverage: **45/45** original roster drawings, 45 distinct SHA-256 hashes. Browser verification decoded all 45 images, checked search and mobile overflow, and reported zero uncaught errors. PNGs have actual transparent pixels (clear fractions approximately 35-70%); this does not qualify edge treatment or sprite use. Desktop/mobile gallery screenshots were visually inspected.
