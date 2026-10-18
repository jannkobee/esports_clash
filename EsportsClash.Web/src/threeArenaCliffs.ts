import { arenaGroundHeight } from './arenaElevation.ts';
import { arenaCampArt } from './arenaArtDirection.ts';
import * as THREE from 'three';
import { CAMP_ROCK_RINGS, ROCK_TERRAIN, campWallPoint } from './arenaRules.ts';

type Section = { x: number; z: number; nx: number; nz: number };
const profile = [[-1, 0], [-.91, .12], [-.76, .57], [-.79, .69], [-.49, .91], [-.08, 1], [.58, .90], [.94, .16], [1, 0]];
const sample = (n: number) => Math.sin(n * 1.73) * .58 + Math.cos(n * .81) * .27 + Math.sin(n * 3.9) * .15;
const ribbonHeight = (i: number, count: number, height: number, seed: number) => {
  const t = i / (count - 1), end = Math.max(0, Math.min(1, t * 16, (1 - t) * 16));
  return height * (.83 + sample(i * .39 + seed) * .12) * end;
};

/** Decoration shares the actual surface height, including the entrance taper. */
export function campCliffCrest(ring: (typeof CAMP_ROCK_RINGS)[number], angle: number, index: number) {
  const gap = ring.stones === 16 ? .71 : .93;
  const phase = ((angle - ring.entrance) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const t = Math.max(0, Math.min(1, (phase - gap) / (Math.PI * 2 - gap * 2)));
  return ribbonHeight(t * 88, 89, ring.stones === 16 ? 43 : 31, index * 13.1) * .965 + 1.1;
}

/** A continuous, layered surface over the existing camp banks. It borrows the
 * real contours and entrances; it never creates a second navigation layout. */
export function createArenaCliffs() {
  const root = new THREE.Group(); root.name = 'sculpted-arena-cliffs';
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, metalness: .025, flatShading: true, side: THREE.DoubleSide });
  const moss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const mineral = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .76, metalness: .13, flatShading: true, side: THREE.DoubleSide });
  const color = new THREE.Color();
  stone.customProgramCacheKey = () => 'arena-stratified-cliff-v2';
  stone.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aCliffHeight;varying vec3 vCliffP;varying float vCliffH;varying float vCliffUp;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCliffP = position;vCliffH=aCliffHeight;vCliffUp=normal.y;');
    shader.fragmentShader = /* glsl */`
      varying vec3 vCliffP;
      varying float vCliffH;
      varying float vCliffUp;
      float cliffHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float cliffGrain(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cliffHash(i),cliffHash(i+vec2(1.,0.)),f.x),mix(cliffHash(i+vec2(0.,1.)),cliffHash(i+vec2(1.)),f.x),f.y);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */`
      #include <color_fragment>
      float rockGrain=cliffGrain(vCliffP.xz*.24+vCliffP.y*.09);
      float strata=sin(vCliffH*.84+cliffGrain(vCliffP.xz*.035)*5.);
      float seam=1.-smoothstep(.025,.14,abs(strata));
      float split=1.-smoothstep(.014,.045,abs(cliffGrain(vCliffP.xz*.10+vCliffP.y*.023)-.51));
      diffuseColor.rgb*=.84+rockGrain*.29;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.43,seam*.22+split*.35);
      float foot=1.-smoothstep(1.,11.,vCliffH);
      diffuseColor.rgb*=1.-foot*.20;
      float lichen=smoothstep(.52,.81,cliffGrain(vCliffP.xz*.12))*smoothstep(10.,26.,vCliffH)*smoothstep(.05,.65,vCliffUp);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.30,.14),lichen*.30);
    `);
  };

  const ribbon = (name: string, sections: Section[], width: number, height: number, seed: number, theme: 'moss' | 'ember' | 'arcane', tint?: string) => {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const capPositions: number[] = [], capColors: number[] = [], capIndices: number[] = [];
    const tintColor=tint?new THREE.Color(tint):undefined;
    const count = sections.length;
    for (let i = 0; i < count; i++) {
      const s = sections[i], h = ribbonHeight(i, count, height, seed);
      for (let j = 0; j < profile.length; j++) {
        const [offset, rise] = profile[j];
        const chips = sample(i * 1.7 + j * 2.4 + seed) * (j > 1 && j < 8 ? 1.7 : .4);
        positions.push(s.x + s.nx * (offset * width + chips), h * rise + .2, s.z + s.nz * (offset * width + chips));
        const face = .80 + sample(i * .27 + j * .62 + seed) * .12;
        const palette = theme === 'ember' ? ['#39413f', '#53534a', '#737065'] : theme === 'arcane' ? ['#303c46', '#505e66', '#747e7b'] : ['#35433e', '#54605a', '#7c8372'];
        color.set(palette[j < 3 ? 0 : j < 6 ? 1 : 2]).multiplyScalar(face);
        if(tintColor)color.lerp(tintColor,.16);
        colors.push(color.r, color.g, color.b);
      }
      // A broken turf lip crowns the rock rather than a separate row of spheres.
      for (const lateral of [-.42, .14, .65]) {
        const bump = sample(i * 1.4 + lateral * 4 + seed) * 1.4;
        capPositions.push(s.x + s.nx * (lateral * width + bump), h * (lateral < .2 ? .965 : .88) + 1.1, s.z + s.nz * (lateral * width + bump));
        color.set(theme === 'ember' ? '#73714a' : '#587044').multiplyScalar(.85 + sample(i + lateral + seed) * .18);
        capColors.push(color.r, color.g, color.b);
      }
      if (i < count - 1) {
        for (let j = 0; j < profile.length - 1; j++) {
          const a = i * profile.length + j, b = a + profile.length;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
        for (let j = 0; j < 2; j++) {
          const a = i * 3 + j, b = a + 3; capIndices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const surface = (pos: number[], rgb: number[], faces: number[], material: THREE.Material, suffix: string) => {
      const localHeights=pos.filter((_,i)=>i%3===1);
      for(let i=0;i<pos.length;i+=3)pos[i+1]+=arenaGroundHeight(pos[i],pos[i+2]);
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      indexed.setAttribute('aCliffHeight',new THREE.Float32BufferAttribute(localHeights,1));
      indexed.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3)); indexed.setIndex(faces);
      const geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name + suffix; root.add(mesh);
    };
    surface(positions, colors, indices, stone, '-stratified-rock');
    surface(capPositions, capColors, capIndices, moss, '-turf-crest');

    // Thin, discontinuous mineral seams follow the inner face's ledges.
    const seamPositions: number[] = [], seamColors: number[] = [], seamIndices: number[] = [];
    for (let layer = 0; layer < 3; layer++) {
      const start = seamPositions.length / 3;
      for (let i = 0; i < count; i++) {
        const s = sections[i], h = ribbonHeight(i, count, height, seed);
        const offset = (-.89 + layer * .13) * width;
        const y = h * (.24 + layer * .22) + sample(i * .4 + layer + seed) * .8;
        for (const dy of [0, .55]) {
          seamPositions.push(s.x + s.nx * offset, Math.max(.3, y + dy), s.z + s.nz * offset);
          color.set(theme === 'arcane' ? '#78688f' : theme === 'ember' ? '#92704e' : '#8d917b').multiplyScalar(.72 + sample(i + seed) * .10);
          seamColors.push(color.r, color.g, color.b);
        }
        if (i < count - 1 && (i + layer * 7) % 13 < 10) {
          const a = start + i * 2; seamIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
        }
      }
    }
    surface(seamPositions, seamColors, seamIndices, mineral, '-mineral-seams');
  };

  for (const [index, ring] of CAMP_ROCK_RINGS.entries()) {
    const boss = ring.stones === 16, gap = boss ? .71 : .93;
    const sections: Section[] = [];
    for (let i = 0; i <= 88; i++) {
      const angle = ring.entrance + gap + (Math.PI * 2 - gap * 2) * i / 88;
      const p = campWallPoint(ring, angle);
      sections.push({ x: p.x, z: p.y, nx: Math.cos(angle), nz: Math.sin(angle) });
    }
    ribbon(ring.id, sections, ring.stoneRadius * .93, boss ? 43 : 31, index * 13.1,
      ring.id === 'dragon_boss' ? 'ember' : ring.id === 'j_siege_golem' || ring.id.includes('blue_buff') ? 'arcane' : 'moss',arenaCampArt(ring.id).stone);
  }

  for (const id of ['blue_highground', 'red_highground']) for (const y of [295, 465]) {
    const rocks = ROCK_TERRAIN.filter(r => r.campId === id && r.y === y).sort((a, b) => a.x - b.x);
    if (!rocks.length) continue;
    const from = rocks[0].x - 18, to = rocks[rocks.length - 1].x + 18;
    const sections = Array.from({ length: 33 }, (_, i) => ({ x: from + (to - from) * i / 32, z: y, nx: 0, nz: y < 380 ? -1 : 1 }));
    ribbon(id + '-' + y, sections, 19, 26, y * .013, 'moss');
  }
  return root;
}
