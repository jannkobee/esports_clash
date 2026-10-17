import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beveledPanel, faceSurface, loftSurface, taperedCurve } from './avatarSurfaceGeometry.ts';
import type { AvatarDesign } from './avatarDesigns.ts';
import type { AvatarModelResources } from './threeAvatarModels.ts';
import { sculptArsenaldo } from './arsenaldoModel.ts';
import {AVATAR_CONTACTS} from './avatarContactProfiles.ts';
import {AVATAR_MESH_PROFILES,meshSection} from './avatarMeshProfiles.ts';

export function sculptAvatarBody(outfit: THREE.Group, id: string, d: AvatarDesign, primary: string,
  accent: string, resources: AvatarModelResources, externalAnatomy = false, externalOutfit = false) {
  const human = !['frog', 'demon', 'dragon', 'wisp', 'skiff', 'rider', 'hedgehog', 'machine'].includes(d.body);
  const width = d.width * (human ? .85 : 1);
  const profile=AVATAR_MESH_PROFILES[id]??AVATAR_MESH_PROFILES.c_invoker;
  const dark = new THREE.Color(primary).multiplyScalar(.3).getStyle();
  const group = (parent: THREE.Object3D, name: string, x: number, y: number, z = 0) => {
    const node = new THREE.Group(); node.name = name; node.userData.avatarPart = name;
    node.position.set(x, y, z); parent.add(node); return node;
  };
  const joint = (parent: THREE.Object3D, name: string, x: number, y: number, z = 0) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, y, z); parent.add(bone); return bone;
  };
  const root = joint(outfit, 'Root', 0, 0), hips = joint(root, 'Hips', 0, 32);
  const spine = joint(hips, 'Spine', 0, 9), chest = joint(spine, 'Chest', 0, 10), head = joint(chest, 'Head', 0, 13);
  const leftJoint = group(root, 'left-arm', -width - 2, human ? 49 : 46);
  const rightJoint = group(root, 'right-arm', width + 2, human ? 49 : 46);
  const armBones = [leftJoint, rightJoint].map((parent, i) => {
    const upper = joint(parent, i ? 'UpperArmR' : 'UpperArmL', 0, 0);
    const fore = joint(upper, i ? 'ForearmR' : 'ForearmL', 0, -11);
    const hand = joint(fore, i ? 'HandR' : 'HandL', 0, -11);
    return [upper, fore, hand];
  });
  const legs: THREE.Group[] = [], legBones: THREE.Bone[][] = [];
  for (const side of [-1, 1]) {
    const pivot = group(root, `leg:${side}`, side * width * .43, 33); legs.push(pivot);
    const thigh = joint(pivot, side < 0 ? 'ThighL' : 'ThighR', 0, 0);
    const calf = joint(thigh, side < 0 ? 'CalfL' : 'CalfR', 0, -17);
    const foot = joint(calf, side < 0 ? 'FootL' : 'FootR', 0, -12); legBones.push([thigh, calf, foot]);
  }
  const bones = [root, hips, spine, chest, head, ...armBones.flat(), ...legBones.flat()];
  const skeleton = new THREE.Skeleton(bones);
  const boneIndex = (bone: THREE.Bone) => bones.indexOf(bone);
  const mesh = (name: string, color: string, geometryFactory: () => THREE.BufferGeometry,
    weights: (x: number, y: number, z: number) => [THREE.Bone, THREE.Bone, number] = () => [root, root, 1]) => {
    if (externalOutfit && /^(tailored-torso|leg-surface|boot-)/.test(name)) return;
    const geometry = resources.geometry(`${id}:sculpt:${name}`, () => {
      const result = geometryFactory(); const positions = result.getAttribute('position');
      const reshape=/^(arm-surface|sleeve|bracer-|tailored-cuff|leg-surface|boot-|tailored-torso|creature-hull|pleated-coat|waist-seam)/.test(name);
      if(profile&&reshape)for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
        if(/^(arm-surface|sleeve|bracer-|tailored-cuff)/.test(name)){
          const center=Math.sign(x)*(width+2);positions.setXYZ(i,center+(x-center)*profile.limb,y,z*profile.limb);
        }else if(/^(leg-surface|boot-)/.test(name)){
          const center=Math.sign(x)*width*.43;positions.setXYZ(i,center+(x-center)*profile.limb,y,z*profile.limb);
        }else if(/^(tailored-torso|creature-hull|pleated-coat|waist-seam)/.test(name)){
          const section=meshSection(profile,y);positions.setXYZ(i,x*section.x,y,z*section.z);
        }
      }
      if(reshape)result.computeVertexNormals();
      const indices: number[] = [], values: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const [a, b, t] = weights(positions.getX(i), positions.getY(i), positions.getZ(i));
        indices.push(boneIndex(a), boneIndex(b), 0, 0); values.push(t, 1 - t, 0, 0);
      }
      result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(values, 4)); return result;
    });
    const result = new THREE.SkinnedMesh(geometry, resources.material(color)); result.name = name;
    result.frustumCulled = false; outfit.add(result); return result;
  };
  const surface = (name: string, color: string, create: () => THREE.BufferGeometry, at: [number, number, number] = [0, 0, 0]) => {
    const result = new THREE.Mesh(resources.geometry(`${id}:detail:${name}`, create), resources.material(color));
    result.name = name; result.position.set(...at); outfit.add(result); return result;
  };
  const left = human ? group(armBones[0][2], 'left-grip', 0, 2) : leftJoint;
  const right = human ? group(armBones[1][2], 'right-grip', 0, 2) : rightJoint;
  if (id === 'c_invoker') {
    sculptArsenaldo(outfit, resources, bones, externalAnatomy);
  } else if (human) {
    mesh('tailored-torso', primary, () => loftSurface([[31, width * .74, 4.4], [35, width * .65, 4],
      [39, width * .65, 3.8], [45, width * .9, 5.1], [49, width, 4.6], [52, width * .85, 3.8], [55, 3, 2.5]]),
    (_x, y) => y < 41 ? [hips, spine, THREE.MathUtils.clamp((41 - y) / 9, 0, 1)] : [spine, chest, THREE.MathUtils.clamp((51 - y) / 10, 0, 1)]);
    mesh('neck', d.skin, () => loftSurface([[54, 2.4, 2.3], [57, 2.2, 2.1], [59, 2.8, 2.4]]), () => [head, head, 1]);
    if (!externalAnatomy) {
    mesh('face-topology', d.skin, faceSurface, () => [head, head, 1]);
    surface('hair-cap', d.hair, () => loftSurface([[66.1, 4.7, 3.8, -.3], [68, 4.8, 3.8, -.4],
      [70, 3.6, 3, -.5], [71.1, 1.1, 1.2, -.5]], 24));
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 1.35;
      surface(`hair-lock-${i}`, d.hair, () => taperedCurve([[x * .7, 70.3, -.2], [x, 69.2, 2], [x + .4, 65.5, 3.8]], .75, .12));
    }
    for (const side of [-1, 1]) {
      resources.mesh(outfit, 'ball', '#e2dbd0', [1.25, .56, .32], [side * 2.1, 64.1, 3.35]);
      resources.mesh(outfit, 'ball', '#3d5962', [.44, .47, .17], [side * 2.1, 64.1, 3.65]);
      resources.mesh(outfit, 'ball', '#111c25', [.2, .34, .1], [side * 2.1, 64.1, 3.8]);
      resources.mesh(outfit, 'ball', '#e3e7e5', [.12, .12, .08], [side * 2, 64.25, 3.91]);
      surface(`brow-${side}`, d.hair, () => taperedCurve([[side * .8, 65.1, 3.6], [side * 2.1, 65.3, 3.7], [side * 3.3, 64.9, 3.1]], .24, .2));
      surface(`ear-${side}`, d.skin, () => loftSurface([[0, .4, .3], [1.1, .8, .55], [2.4, .6, .45], [3.1, .2, .2]], 12), [side * 4.5, 61.5, 0]);
    }
    surface('lip-contour', '#92685e', () => taperedCurve([[-1.4, 60.8, 3], [0, 60.6, 3.4], [1.4, 60.8, 3]], .16, .5));
    }
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, x = side * (width + 2), [upper, fore, hand] = armBones[i];
      const armWeight = (_x: number, y: number): [THREE.Bone, THREE.Bone, number] =>
        y > 36 ? [upper, fore, THREE.MathUtils.clamp((y - 36) / 5, 0, 1)] : [fore, hand, THREE.MathUtils.clamp((y - 27) / 5, 0, 1)];
      mesh(`arm-surface-${i}`, d.skin, () => loftSurface([[27, 1.1, 1.1], [30, 1.5, 1.3], [34, 2.1, 1.7],
        [38, 2, 1.7], [43, 2.4, 2.1], [47, 2.8, 2.4], [50, 2.1, 2]], 16).translate(x, 0, 0), armWeight);
      mesh(`sleeve-${i}`, primary, () => loftSurface([[41, 2.6, 2.3], [46, 3, 2.6], [49, 3.2, 2.8], [51, 1.7, 2]], 16).translate(x, 0, 0), () => [upper, upper, 1]);
      // A closed bridge overlaps the chest and sleeve, with a continuous chest/arm blend.
      mesh(`shoulder-gusset-${i}`,primary,()=>new THREE.SphereGeometry(1,20,14).scale(4.5*profile.limb,3.3,3.4*profile.limb).translate(x-side*1.4,49,0),
        (px)=>[chest,upper,THREE.MathUtils.clamp((width+1-Math.abs(px))/5,0,1)]);
      if(profile.finish==='plate'||profile.finish==='leather'){
        mesh(`layered-pauldron-${i}`,profile.finish==='plate'?'#a5b9ba':dark,()=>new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.65).scale(4.8,2.8,3.7).translate(x-side*.5,50.8,0),()=>[upper,upper,1]);
      }
      mesh(`tailored-cuff-${i}`,accent,()=>loftSurface([[29,1.65,1.5],[29.4,1.9,1.65],[31,1.85,1.6],[31.5,1.6,1.45]],16).translate(x,0,0),()=>[fore,fore,1]);
      if (!externalAnatomy) mesh(`hand-${i}`, d.skin, () => {
        const pieces = [loftSurface([[24, 1.4, .7], [26, 1.8, .85], [28, 1.3, 1]], 12).translate(x, 0, 0)];
        for (let f = 0; f < 4; f++) pieces.push(taperedCurve([[x + (f - 1.5) * .75, 24.6, .1],
          [x + (f - 1.5) * .75, 22.8 - (f % 3) * .25, .7], [x + (f - 1.5) * .7, 22.4, 1.8]], .39, .75, 6));
        pieces.push(taperedCurve([[x + side * 1.6, 26.3, 0], [x + side * 2.3, 24.7, 1], [x + side * 1.4, 24, 2]], .5, .7, 6));
        const merged = mergeGeometries(pieces.map(piece => piece.toNonIndexed())); pieces.forEach(piece => piece.dispose());
        if (!merged) throw Error('Hand topology merge failed');
        const contact=AVATAR_CONTACTS[id],close=(i?contact?.closeRight:contact?.closeLeft)??0,positions=merged.getAttribute('position');
        for(let v=0;v<positions.count;v++){
          const y=positions.getY(v),distance=Math.max(0,24.9-y),theta=Math.min(distance/1.2,Math.PI*.85);
          if(distance){positions.setY(v,y+(24.9-1.2*Math.sin(theta)-y)*close);positions.setZ(v,positions.getZ(v)+1.2*(1-Math.cos(theta))*close);}
        }
        merged.computeVertexNormals();return merged;
      }, () => [hand, hand, 1]);
      const [thigh, calf, foot] = legBones[i], legX = side * width * .43;
      mesh(`leg-surface-${i}`, dark, () => loftSurface([[5, 1.6, 1.8], [10, 2.2, 2.1], [15, 2.1, 2.1],
        [18, 2.6, 2.5], [24, 3.1, 2.9], [31, 3.3, 3], [34, 2.7, 2.6]], 16).translate(legX, 0, 0),
      (_x, y) => [thigh, calf, THREE.MathUtils.clamp((y - 14) / 6, 0, 1)]);
      mesh(`boot-${i}`, '#39454c', () => loftSurface([[1, 2.5, 4.7, 2], [2, 2.7, 4.8, 2], [4, 2.6, 4.1, 1.5],
        [6, 2, 2.7, .3], [9, 2.2, 2.1]], 16).translate(legX, 0, 0), () => [foot, foot, 1]);
      mesh(`bracer-${i}`, '#b8c1bd', () => loftSurface([[0, 1.6, 1.5], [1, 1.9, 1.8], [6, 2.1, 1.9], [7, 1.7, 1.6]], 16).translate(x, 29, 0), () => [fore, fore, 1]);
    }
    if (d.body === 'robe') {
      mesh('pleated-coat', primary, () => loftSurface([[7, width * 1.17, 6.4], [11, width * 1.15, 6.2],
        [23, width * .84, 4.7], [32, width * .73, 4.5], [36, width * .65, 4.2]], 32, .09), (x,y) => [hips,legBones[x<0?0:1][0],1-THREE.MathUtils.clamp((32-y)/25,0,1)*.32]);
      surface('coat-front-trim', accent, () => beveledPanel([[-.6, 8], [.6, 8], [.8, 34], [-.8, 34]], .35, .08), [0, 0, 6.4]);
    }
    mesh('fitted-neckline',dark,()=>loftSurface([[53,3.5,2.9],[54,3.8,3],[56,3.25,2.75],[57,2.8,2.5]],24),()=>[head,head,1]);
    const seamColor=new THREE.Color(accent).lerp(new THREE.Color(primary),.45).getStyle();
    for(const side of [-1,1])mesh('tailored-seam-'+side,seamColor,()=>taperedCurve([[side*width*.28,35,4.5],[side*width*.52,43,5.3],[side*width*.63,49,4.9]],.18,.8,14),(_x,y)=>[spine,chest,THREE.MathUtils.clamp((48-y)/10,0,1)]);
    mesh('waist-seam',dark,()=>loftSurface([[31.4,width*.76,4.8],[32,width*.78,4.9],[33.4,width*.77,4.8]],24),()=>[hips,hips,1]);
    if (d.body === 'knight' || d.body === 'stone') {
      surface('contoured-breastplate', '#a5b9ba', () => beveledPanel([[-width * .85, 49], [width * .85, 49],
        [width * .7, 40], [0, 36], [-width * .7, 40]], 1.5, .4), [0, 0, 4.7]);
      for (const side of [-1, 1]) surface(`tasset-${side}`, primary, () => beveledPanel([[-3, 13], [3, 13], [4, 27], [-3, 29]], 1, .25), [side * width * .62, 0, 4.6]);
    }
    if (!externalOutfit) {
      surface('waist-belt', '#705644', () => loftSurface([[31, width * .76, 4.7], [33, width * .75, 4.7]], 20));
      resources.mesh(outfit, 'box', '#c7ab70', [3.2, 2.8, 1], [0, 32, 5]);
    }
  } else {
    // Nonhumanoid bodies retain their own anatomy, with an editable root-bound skin.
    const profile = d.body === 'frog' ? [[8, 11, 9], [14, 19, 13], [30, 22, 15], [43, 17, 13], [50, 12, 9]]
      : d.body === 'demon' ? [[12, 4, 4], [26, 10, 8], [44, 18, 12], [59, 15, 9], [67, 5, 4]]
        : d.body === 'machine' ? [[14, 10, 9], [25, 21, 15], [44, 23, 16], [54, 14, 11]]
          : d.body === 'skiff' ? [[15, 8, 18], [18, 16, 24], [27, 19, 25], [32, 12, 20]]
            : d.body === 'hedgehog' ? [[10, 10, 10], [24, 20, 17], [40, 22, 18], [52, 13, 9]]
              : d.body === 'wisp' ? [[24, 3, 3], [30, 12, 10], [42, 15, 12], [54, 8, 7], [60, 1, 1]]
                : [[15, 5, 8], [20, 12, 17], [29, 13, 20], [35, 7, 12]];
    mesh('creature-hull', d.body === 'skiff' ? primary : d.skin, () => loftSurface(profile as [number, number, number][], 24));
    if (d.body === 'machine' || d.body === 'hedgehog') for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, x = side * width * .43, [thigh, calf, foot] = legBones[i];
      mesh(`creature-leg-${i}`, dark, () => loftSurface([[4, 3.2, 3.6], [10, 3.7, 3.7], [18, 4.1, 4.1], [29, 4.4, 4.5]], 16).translate(x, 0, 0),
        (_x, y) => [thigh, calf, THREE.MathUtils.clamp((y - 12) / 8, 0, 1)]);
      mesh(`creature-foot-${i}`, d.body === 'machine' ? '#8a9d9e' : d.skin,
        () => loftSurface([[1, 4.3, 6.4, 2], [3, 4.8, 6.7, 2], [6, 3.7, 4.9, 1], [9, 3.2, 3.2]], 16).translate(x, 0, 0), () => [foot, foot, 1]);
      if (d.body === 'hedgehog') {
        const armX = side * (width + 2), [upper, fore] = armBones[i];
        mesh(`quillback-arm-${i}`, d.skin, () => loftSurface([[17, 3.5, 3.2], [23, 4.4, 4], [35, 4.9, 4.6], [44, 4.1, 3.9]], 16).translate(armX, 0, 0),
          (_x, y) => [upper, fore, THREE.MathUtils.clamp((y - 28) / 8, 0, 1)]);
      }
    }
  }
  outfit.updateMatrixWorld(true);
  outfit.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.bind(skeleton); });
  return { left, right, leftJoint, rightJoint, legs, skeleton, human, width };
}
