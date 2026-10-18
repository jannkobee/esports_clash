import * as THREE from 'three';
import { AVATAR_ANIMATION_MOTIFS } from './avatarSkillAnimation.ts';
import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities.ts';
import { kaelenCastPosition, type KaelenCast } from './kaelenSpellRuntime.ts';
import { drawDashDetail, drawHookDetail, drawPrismFormation, drawSpellDetail, type DetailPainter } from './threeAbilityDetails.ts';
import {AvatarProjectilePresentation} from './avatarProjectilePresentation.ts';
import type {WeaponSocket} from './avatarWeaponSockets.ts';
import {AVATAR_WEAPON_FINISH,WEAPON_FINISH_COLORS} from './avatarWeaponPolish.ts';

type Point = { readonly x: number; readonly y: number };
type V = [number, number, number];
export type WeaponImpact=Point & {readonly id:string;readonly avatarId:string;readonly kind:'melee'|'ranged';readonly color:string;readonly age:number};
export type AbilityProjectile = Point & { readonly id: string; readonly color: string; readonly size: number;
  readonly angle: number; readonly type?: string; readonly attackerId?: string; readonly targetX?:number; readonly targetY?:number };
export type AbilitySpell = Point & { readonly id: string; readonly radius: number; readonly color: string;
  readonly duration: number; readonly maxDuration: number; readonly type?: string;
  readonly halfWidth?: number; readonly halfHeight?: number; readonly avatarName?: string;
  readonly abilitySlot?: string; readonly sourceX?: number; readonly sourceY?: number;
  readonly sourceUnitId?: string; readonly targetUnitId?: string; readonly sourceHeight?:number; readonly kaelenCast?: Readonly<KaelenCast> };
export type AbilitySource = Point & { readonly id: string; readonly isAlive?: boolean;
  readonly visualEvolution?: {readonly version:number;readonly facet_count:number;readonly trail_segments:number;readonly accent_height:number};
  readonly champion?: {readonly name:string}; readonly weaponSocket?:WeaponSocket; readonly attackAge?:number;
  readonly dash?: { readonly kind: string; readonly remaining: number; readonly startX?: number; readonly startY?: number };
  readonly blackHole?: Point & { readonly remaining: number };
  readonly corsaraBarrage?: { readonly remaining: number; readonly facing: 'left' | 'right' };
  readonly monkeySpin?: { readonly remaining: number };
  readonly monkeyCourt?: Point & { readonly remaining: number } };
export type AbilityStyle = 'slash' | 'lightning' | 'fire' | 'ice' | 'wind' | 'earth' | 'roots' |
  'heal' | 'void' | 'beam' | 'smoke' | 'music' | 'impact' | 'wall';

/** Explicit spell events take priority over a hero's general visual vocabulary. */
export function abilityEffectStyle(spell: AbilitySpell): AbilityStyle {
  const type = spell.type ?? '';
  if (/rotor_overdrive|propella_air_superiority/.test(type)) return 'wind';
  if (type === 'electric_vortex') return 'beam';
  if (/wind_wall/.test(type)) return 'wall';
  if (/black_hole|vortex|aether_remnant/.test(type)) return 'void';
  if (/forest_link|ultimate_link|ribbon_lash|soul_draw|broadside_channel/.test(type)) return 'beam';
  if (/smoke|ash_veil|mist_double/.test(type)) return 'smoke';
  if (/lightning|static|magnetize|overcharge/.test(type)) return 'lightning';
  if (/faultline|quake|maul|golem|boss_slam/.test(type)) return 'earth';
  if (/sprout|treants|branch|canopy/.test(type)) return 'roots';
  if (/grave|respite|daybreak|marsh_anthem/.test(type)) return 'heal';
  if (/solar_flare|cinder|flak|shotgun/.test(type)) return 'fire';
  if (/sleight|cyclone_dance/.test(type)) return 'slash';
  if (/bogbeat|dirge/.test(type)) return 'music';
  const motif = spell.avatarName ? AVATAR_ANIMATION_MOTIFS[spell.avatarName] : undefined;
  if (motif && ['blades','shadow','fist','staffspin','martial','hammer','quill','bear','wolf'].includes(motif)) return 'slash';
  if (motif && ['lightning','wisp','grapple'].includes(motif)) return 'lightning';
  if (motif && ['ember','ash','rocket','shotgun','rotor','cask','broadside'].includes(motif)) return 'fire';
  if (motif && ['gravity','void','souls','silence'].includes(motif)) return 'void';
  if (motif && ['roots','bloom','canopy'].includes(motif)) return 'roots';
  if (motif && ['wind','feathers','wings','faerie'].includes(motif)) return 'wind';
  if (motif && ['sun','orb','relic','lantern','elements','paint','arsenal'].includes(motif)) return 'beam';
  if (motif === 'arrow') return 'ice';
  if (motif === 'music') return 'music';
  if (motif === 'boulder' || motif === 'quake') return 'earth';
  if (motif === 'grave' || motif === 'mist') return 'heal';
  if (motif === 'hook' || motif === 'lasso') return 'beam';
  return 'impact';
}

function crescentGeometry() {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36, angle = -.9 * Math.PI + t * Math.PI * 1.8;
    const width = Math.sin(t * Math.PI) ** .6 * .22;
    for (const radius of [1 - width, 1]) { positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius); uv.push(t, radius); }
    if (i < 36) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); result.setIndex(indices); result.computeVertexNormals(); return result;
}

function flameGeometry() {
  const result = new THREE.ConeGeometry(1, 1, 9, 5), position = result.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setXYZ(i, position.getX(i) + (y + .5) ** 2 * .75, y, position.getZ(i) + Math.sin(y * 7) * .13);
  }
  result.computeVertexNormals(); return result;
}

/** Pooled, simulation-time VFX: no event listeners, live-world retention or gameplay RNG. */
export class ArenaAbilityEffects {
  readonly root = new THREE.Group();
  private readonly owner = new THREE.Group();
  private readonly geometry = {
    ball: new THREE.SphereGeometry(1, 12, 8), shard: new THREE.OctahedronGeometry(1),
    beam: new THREE.CylinderGeometry(1, 1, 1, 6), cone: new THREE.ConeGeometry(1, 1, 8),
    ring: new THREE.RingGeometry(.97, 1, 64), box: new THREE.BoxGeometry(1, 1, 1),
    arc: crescentGeometry(), flame: flameGeometry(),
    root: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -.5, 0),
      new THREE.Vector3(.3, -.15, 0), new THREE.Vector3(-.4, .2, .2), new THREE.Vector3(.1, .5, .1)]), 12, .15, 5, false),
    chain: new THREE.TorusGeometry(1, .22, 4, 10),
    hook: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(.2, 0, 0), new THREE.Vector3(.9, .2, 0), new THREE.Vector3(1, .8, 0),
      new THREE.Vector3(.5, 1.1, 0), new THREE.Vector3(.15, .65, 0)]), 18, .15, 6, false),
  };
  private readonly pool: THREE.Mesh[] = [];
  private readonly batches = new Map<THREE.BufferGeometry, THREE.InstancedMesh>();
  private readonly instanceColor = new THREE.Color();
  private readonly glowMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false, forceSinglePass: true });
  private readonly arcGlowMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true });
  private used = 0;
  private readonly launches=new AvatarProjectilePresentation();
  private readonly weaponTrails=new Map<string,{second:number;tip:V}[]>();
  private lastSecond=-1;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly details: DetailPainter = {
    mesh: (...args) => this.mesh(...args), beam: (...args) => this.beam(...args), ring: (...args) => this.ring(...args),
  };
  private readonly groundHeight: (x:number,y:number)=>number;

  constructor(groundHeight: (x:number,y:number)=>number = () => 0) {
    this.groundHeight=groundHeight;
    this.root.name = 'ability-effects'; this.owner.visible = false; this.root.add(this.owner);
    const material = new THREE.MeshBasicMaterial();
    for (const geometry of Object.values(this.geometry)) this.owner.add(new THREE.Mesh(geometry, material));
    this.owner.add(new THREE.Mesh(this.geometry.ball, this.glowMaterial));
    this.owner.add(new THREE.Mesh(this.geometry.arc, this.arcGlowMaterial));
  }

  private mesh(shape: keyof ArenaAbilityEffects['geometry'], color: string, alpha: number,
    at: V, scale: V, glow = true, worldHeight = false) {
    let mesh = this.pool[this.used++];
    if (!mesh) {
      mesh = new THREE.Mesh(this.geometry[shape], new THREE.MeshBasicMaterial({ transparent: true,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true }));
      mesh.frustumCulled = false; this.pool.push(mesh); this.root.add(mesh);
    }
    mesh.geometry = this.geometry[shape]; mesh.visible = alpha > .001;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(color); material.opacity = THREE.MathUtils.clamp(alpha, 0, 1);
    material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    // Glow particles are rendered in geometry batches; opaque smoke/rocks remain normal meshes.
    const parent = glow ? this.owner : this.root;
    if (mesh.parent !== parent) parent.add(mesh);
    mesh.position.set(at[0],at[1]+(worldHeight?0:this.groundHeight(at[0],at[2])),at[2]); mesh.scale.set(...scale); mesh.rotation.set(0, 0, 0); return mesh;
  }
  private beam(a: V, b: V, color: string, width: number, alpha: number) {
    this.from.set(a[0],a[1]+this.groundHeight(a[0],a[2]),a[2]); this.to.set(b[0],b[1]+this.groundHeight(b[0],b[2]),b[2]); this.delta.subVectors(this.to, this.from);
    const length = this.delta.length();
    const mesh = this.mesh('beam', color, alpha, [(this.from.x+this.to.x)/2,(this.from.y+this.to.y)/2,(this.from.z+this.to.z)/2], [width, Math.max(.01, length), width],true,true);
    if (length > .001) mesh.quaternion.setFromUnitVectors(this.up, this.delta.divideScalar(length));
    return mesh;
  }
  private ring(x: number, y: number, radius: number, color: string, alpha: number, height = 2) {
    const mesh = this.mesh('ring', color, alpha, [x, height, y], [radius, radius, 1]); mesh.rotation.x = -Math.PI / 2;
    if(height<=3&&alpha>.001){
      const center=this.groundHeight(x,y);
      const crossesSlope=Array.from({length:8},(_,i)=>this.groundHeight(x+Math.cos(i*Math.PI/4)*radius,y+Math.sin(i*Math.PI/4)*radius)).some(h=>Math.abs(h-center)>.8);
      if(crossesSlope){
        mesh.visible=false;
        let a:V=[x+radius,height,y];
        for(let i=1;i<=64;i++){
          const angle=i*Math.PI/32,b:V=[x+Math.cos(angle)*radius,height,y+Math.sin(angle)*radius];
          this.beam(a,b,color,Math.max(.6,radius*.016),alpha);a=b;
        }
      }
    }
    return mesh;
  }
  private sparks(x: number, y: number, radius: number, age: number, color: string, count = 7) {
    const t = Math.min(1, Math.max(0, age)), fade = (1 - t) ** 1.3;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + .4, travel = radius * (.15 + t * .85);
      const height = 7 + Math.sin(t * Math.PI) * (14 + (i % 3) * 9);
      const mesh = this.mesh('shard', color, fade, [x + Math.cos(angle) * travel, height, y + Math.sin(angle) * travel], [1.5, 4.5 * (1 - t) + .4, 1.5]);
      mesh.rotation.set(angle, age * 4, -angle);
    }
  }
  private lightning(a: V, b: V, color: string, alpha: number, time: number, width = 1.7) {
    const phase = Math.floor(time * 12), dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
    let previous = a;
    for (let i = 1; i <= 7; i++) {
      const t = i / 7, offset = i === 7 ? 0 : Math.sin(i * 17.3 + phase * 2.1) * Math.min(15, length * .09);
      const next: V = [a[0] + dx * t - dz / length * offset, a[1] + (b[1] - a[1]) * t + Math.sin(i + phase) * (i === 7 ? 0 : 3), a[2] + dz * t + dx / length * offset];
      this.beam(previous, next, color, width, alpha); previous = next;
    }
  }

  private projectile(input: AbilityProjectile, second: number, source?: AbilitySource) {
    const presentation=this.launches.sample(input,second,source?.weaponSocket,source);
    const p=presentation?{...input,x:presentation.at[0],y:presentation.at[2]}:input;
    const size = Math.max(2, Math.min(16, p.size)), type = p.type==='orb'&&(presentation?.style??source?.weaponSocket?.style)==='gun'?'flak_round':p.type ?? 'orb', dx = Math.cos(p.angle), dz = Math.sin(p.angle);
    const height=presentation?.at[1]??27;
    const at: V = [p.x, height, p.y], tail: V = presentation?.tail??[p.x - dx * (size * 5 + 12), height, p.y - dz * (size * 5 + 12)];
    if(presentation&&presentation.age<.09){
      const fade=1-presentation.age/.09,origin=presentation.launch;
      // Keep the flash on the moving weapon; the projectile retains its launch snapshot.
      const flash=source?.weaponSocket?.tip??origin;
      if(source?.weaponSocket?.style==='gun'){
        const base=source.weaponSocket.base,flashFloor=this.groundHeight(flash[0],flash[2]),baseFloor=this.groundHeight(base[0],base[2]);
        this.delta.set(flash[0]-base[0],flash[1]+flashFloor-base[1]-baseFloor,flash[2]-base[2]).normalize();
        const flare=this.mesh('cone',p.color,fade*.8,
          [flash[0]+this.delta.x*size,flash[1]+flashFloor+this.delta.y*size,flash[2]+this.delta.z*size],[size*.8,size*2,size*.8],true,true);
        flare.quaternion.setFromUnitVectors(this.up,this.delta);
        const endX=flash[0]+this.delta.x*size*2.5,endZ=flash[2]+this.delta.z*size*2.5;
        this.beam(flash,[endX,flash[1]+flashFloor+this.delta.y*size*2.5-this.groundHeight(endX,endZ),endZ],'#fff4d5',size*.25,fade);
      }else{
        this.mesh('ball',p.color,fade*.4,flash,[size*.65,size*.65,size*.65]);
      }
      const finish=AVATAR_WEAPON_FINISH[source?.weaponSocket?.avatarId??'']??'steel',color=WEAPON_FINISH_COLORS[finish];
      if(finish==='powder'||finish==='rocket'){
        // Short hot embers and a small rising puff; density is bounded per shot.
        for(let i=0;i<3;i++){
          const a=i*2.399,travel=(1-fade)*13;
          this.mesh('shard',color,fade*.65,[flash[0]+dx*travel+Math.sin(a)*3,flash[1]+(1-fade)*(5+i*3),flash[2]+dz*travel+Math.cos(a)*3],[.6,1.5,.6]);
        }
        this.mesh('ball','#8e9297',fade*.16,[flash[0]+dx*6,flash[1]+(1-fade)*9,flash[2]+dz*6],[size*.8,size*.6,size*.8],false);
      }else if(finish==='frost'||finish==='spirit'){
        for(const side of [-1,1]){
          const shard=this.mesh('shard',color,fade*.75,[flash[0]-dz*side*size,flash[1]+side*size*.3,flash[2]+dx*side*size],[.6,3,.6]);shard.rotation.z=side*.6;
        }
      }else if(finish==='nature'||finish==='ink'){
        for(const side of [-1,1]){
          const leaf=this.mesh(finish==='ink'?'ball':'shard',color,fade*.65,[flash[0]+side*size,flash[1]+fade*3,flash[2]],[size*.5,.6,size]);leaf.rotation.y=side*.7;
        }
      }else if(finish==='storm')this.lightning(flash,[flash[0]+dx*12,flash[1]+4,flash[2]+dz*12],color,fade,second,.7);
    }
    if (type === 'hook') {
      const tip=source?.weaponSocket?.tip;
      drawHookDetail(this.details, p.x, p.y, size, p.angle, p.color, tip?{x:tip[0],y:tip[2],height:tip[1]}:source,height);
    } else if (type === 'tornado') {
      this.vortex(p.x, p.y, size * 2.7, p.color, second, .85, false); return;
    } else if (type === 'electric_spark') {
      this.lightning(tail, at, p.color, .9, second, 1.3);
    } else if (type === 'laser') {
      this.beam(tail, at, p.color, size * .75, .45);
      this.beam(tail, at, '#f3feff', size * .22, 1);
    } else if (type === 'boss_breath') {
      for (let i = 0; i < 5; i++) {
        const distance = i * size * 1.8, radius = size * (.4 + i * .2);
        this.mesh('shard', i % 2 ? '#ffce65' : p.color, .8 - i * .1,
          [p.x - dx * distance, 27 + Math.sin(second * 15 + i) * 5, p.y - dz * distance], [radius, radius * 1.8, radius]);
      }
    } else if (type === 'nature_bolt' || type === 'seed_shot') {
      this.mesh('shard', '#ecf8a4', .95, at, [size * .6, size, size * .6]);
      for (const side of [-1, 1]) {
        const leaf = this.mesh('shard', p.color, .8, [p.x - dx * size, height+1, p.y - dz * size], [size * .65, .5, size * 1.8]);
        leaf.rotation.y = -p.angle + side * .65;
      }
    } else if (type === 'pellet' || type === 'flak_round') {
      this.beam(tail, at, p.color, size * .55, .5);
      const shell = this.mesh('cone', '#ead7ab', 1, at, [size * .45, size * (type==='pellet'?1.5:2.8), size * .45], false);
      shell.quaternion.setFromUnitVectors(this.up, this.delta.set(dx, 0, dz));
    } else if (['arrow','ult_arrow','spirit_arrow','poison_dart','feather'].includes(type)) {
      this.beam(tail, at, p.color, Math.max(.7, size * .25), .85);
      const tip = this.mesh('cone', '#e9fcff', .95, at, [size * .8, size * 3.2, size * .8]);
      this.delta.set(dx, 0, dz); tip.quaternion.setFromUnitVectors(this.up, this.delta);
    } else if (type === 'shuriken') {
      for (let i = 0; i < 2; i++) { const blade = this.mesh('shard', p.color, 1, at, [size * 2.3, 1, size * .55]); blade.rotation.y = second * 18 + i * Math.PI / 2; }
    } else if (type === 'boulder') {
      const rock = this.mesh('shard', '#9a8d7c', 1, at, [size * 1.4, size * 1.4, size * 1.4], false); rock.rotation.set(second * 5, 0, p.angle);
    } else {
      this.beam(tail, at, p.color, size * .7, .3);
      this.mesh('ball', p.color, .35, at, [size * 1.7, size * 1.7, size * 1.7]);
      this.mesh('shard', '#fff3d6', 1, at, [size * .65, size * .65, size * .65]);
    }
    // Tapering travelling afterimages use the actual current projectile position/direction.
    for (let i = 1; i <= 3; i++) {
      const fraction=i/3;
      this.mesh('shard', p.color, .4 / i,
        presentation?[at[0]+(tail[0]-at[0])*fraction,height,at[2]+(tail[2]-at[2])*fraction]:
          [p.x - dx * i * size * 2.5, height + Math.sin(second * 12 + i) * 2, p.y - dz * i * size * 2.5], [size / i, size / i, size / i]);
    }
  }

  private vortex(x: number, y: number, radius: number, color: string, time: number, alpha: number, dark: boolean) {
    if (dark) this.mesh('ball', '#130e28', .9, [x, 22, y], [radius * .26, radius * .26, radius * .26], false);
    for (let i = 0; i < 4; i++) {
      const r = radius * (.3 + i * .2), arc = this.mesh('arc', color, alpha * (1 - i * .12), [x, 9 + i * 12, y], [r, 1, r]);
      arc.rotation.set(.12 * Math.sin(time + i), time * (i % 2 ? -2 : 2) + i * 1.5, .15 * Math.cos(time + i));
    }
  }

  private invoked(s: AbilitySpell, second: number): boolean {
    const cast = s.kaelenCast, spell = cast && KAELEN_INVOKED_SPELLS.find(spell => spell.id === cast.spellId);
    if (!cast || !spell) return false;
    const at = kaelenCastPosition(cast, spell), remaining = Math.min(1, Math.max(0, s.duration / Math.max(.01, s.maxDuration)) * 3);
    const winding = cast.elapsed < spell.delay, activeAge = Math.max(0, cast.elapsed - spell.delay);
    // The precise runtime position/radius is retained for travelling and growing spells.
    this.ring(at.x, at.y, at.radius, spell.color, winding ? .8 : .3 * remaining);
    if (spell.shape === 'summon') {
      drawPrismFormation(this.details, at.x, at.y, cast.elapsed, spell.color, remaining);
    } else if (spell.shape === 'meteor' && winding) {
      const height = 28 + 200 * (1 - cast.elapsed / spell.delay);
      this.mesh('shard', '#fff3bf', 1, [at.x, height, at.y], [15, 21, 15]);
      this.beam([at.x - 35, height + 85, at.y - 20], [at.x, height, at.y], spell.color, 11, .6);
    } else if (!winding && spell.shape === 'snowball') {
      const ball = this.mesh('ball', '#ccecff', .95, [at.x, at.radius * .7, at.y], [at.radius * .75, at.radius * .75, at.radius * .75], false);
      ball.rotation.z = -cast.elapsed * 5;
      this.sparks(at.x, at.y, at.radius, (activeAge * 1.4) % 1, spell.color, 6);
    } else if (!winding && spell.shape === 'line') {
      const angle = Math.atan2(cast.aim.y - cast.origin.y, cast.aim.x - cast.origin.x);
      for (let i = -1; i <= 1; i++) {
        const shard = this.mesh('arc', spell.color, .85 * remaining, [at.x, 19 + Math.abs(i) * 7, at.y], [at.radius, 1, at.radius * .4]);
        shard.rotation.set(i * .25, -angle + i * .2, .2);
      }
      this.sparks(at.x, at.y, at.radius * .7, (activeAge * 2) % 1, '#effcff', 4);
    } else if (!winding) {
      const style: AbilityStyle = spell.shape === 'meteor' ? 'fire' : spell.shape === 'ally' ? 'heal' :
        spell.id === 'ashen-cyclone' ? 'lightning' : 'ice';
      this.burst({ ...s, x: at.x, y: at.y, radius: at.radius }, style, Math.min(1, activeAge / Math.max(.3, spell.zone?.duration ?? .5)), second, remaining);
    }
    return true;
  }

  private burst(s: AbilitySpell, style: AbilityStyle, p: number, second: number, fade: number) {
    const r = Math.max(4, s.radius), color = s.color, ultimate = s.abilitySlot === 'ultimate' || s.type === 'ultimate_burst';
    const pulse = Math.sin(Math.min(1, p * 2) * Math.PI), x = s.x, y = s.y;
    const angle = s.sourceX !== undefined && s.sourceY !== undefined ? Math.atan2(y - s.sourceY, x - s.sourceX) : 0;
    if (style === 'slash') {
      for (let i = 0; i < (ultimate ? 3 : 2); i++) {
        const arc = this.mesh('arc', i ? '#fff1dc' : color, fade * (i ? .6 : 1), [x, 22 + i * 13, y], [r * (.5 + p * .55), 1, r * (.5 + p * .55)]);
        arc.rotation.set(.3 + i * .4, -angle + p * 5 + i * 2.1, .2);
      }
      this.sparks(x, y, r * .7, p, color, ultimate ? 9 : 5);
    } else if (style === 'lightning') {
      for (let i = 0; i < (ultimate ? 4 : 2); i++) {
        const a = i * 2.4 + second * .8;
        this.lightning([x + Math.cos(a) * r * .65, 100 + i * 12, y + Math.sin(a) * r * .65], [x, 9, y], color, fade, second + i);
      }
    } else if (style === 'void' || style === 'wind') {
      this.vortex(x, y, r, color, second, fade, style === 'void');
    } else if (style === 'fire' || style === 'ice' || style === 'earth' || style === 'roots') {
      for (let i = 0; i < (ultimate ? 10 : 6); i++) {
        const a = i * 2.39996, travel = r * (.22 + (i % 3) * .23), growth = Math.sin(Math.min(1, p * 3) * Math.PI / 2);
        const height = (style === 'fire' ? 22 + Math.sin(second * 14 + i) * 9 : 24 + (i % 3) * 12) * growth;
        const px = x + Math.cos(a) * travel, py = y + Math.sin(a) * travel;
        const mesh = this.mesh(style === 'roots' ? 'root' : style === 'fire' ? 'flame' : 'shard', style === 'roots' ? '#63894c' : color, fade * .8,
          [px, height / 2, py], [style === 'earth' ? 12 : style === 'roots' ? 18 : 5, Math.max(.1, height), style === 'earth' ? 10 : style === 'roots' ? 18 : 5], style !== 'earth' && style !== 'roots');
        mesh.rotation.set(Math.cos(a) * .3, a, Math.sin(a) * .3);
        if (style === 'roots') {
          const leaf = this.mesh('shard', color, fade * .55, [px + Math.cos(a) * 4, height * .8, py + Math.sin(a) * 4], [5, 1.1, 9]);
          leaf.rotation.set(.3, a, -.5);
        }
      }
      this.sparks(x, y, r, p, style === 'fire' ? '#ffd29b' : color, ultimate ? 10 : 6);
    } else if (style === 'heal') {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + second * .6, rise = (p * 1.8 + i / 6) % 1;
        const px = x + Math.cos(a) * r * .65, py = y + Math.sin(a) * r * .65;
        this.beam([px - 4, 8 + rise * 55, py], [px + 4, 8 + rise * 55, py], color, 1.2, fade * (1 - rise));
        this.beam([px, 4 + rise * 55, py], [px, 12 + rise * 55, py], color, 1.2, fade * (1 - rise));
      }
    } else if (style === 'smoke') {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + second * .15;
        this.mesh('ball', color, fade * .13, [x + Math.cos(a) * r * .5, 12 + (i % 3) * 9, y + Math.sin(a) * r * .5], [r * .37, 14, r * .37], false);
      }
    } else if (style === 'wall') {
      const wall = this.mesh('box', color, fade * .17, [x, 31, y], [r * 2, 60, 5]); wall.rotation.y = -angle;
      for (let i = 0; i < 4; i++) this.beam([x - r, 5 + i * 17, y], [x + r, 5 + i * 17, y], color, 1, fade * .6);
    } else if (style === 'beam') {
      if (s.sourceX !== undefined && s.sourceY !== undefined && Math.hypot(x - s.sourceX, y - s.sourceY) > 5) {
        if (s.type === 'electric_vortex') this.lightning([s.sourceX, s.sourceHeight??34, s.sourceY], [x, 27, y], color, fade, second, 2.1);
        this.beam([s.sourceX, s.sourceHeight??34, s.sourceY], [x, 27, y], color, (ultimate ? 7 : 4) * (.5 + pulse), fade * .45);
        this.beam([s.sourceX, s.sourceHeight??34, s.sourceY], [x, 27, y], '#fff9dc', ultimate ? 1.8 : 1, fade * .8);
      }
      this.mesh('shard', '#fff4d9', fade, [x, 27, y], [r * .12, r * .3, r * .12]);
      this.sparks(x, y, r * .8, p, color);
    } else if (style === 'music') {
      for (let i = 0; i < 3; i++) {
        const size = r * (.2 + ((p + i / 3) % 1) * .8), ring = this.ring(x, y, size, color, fade * .6, 10 + i * 10);
        ring.rotation.x = -.8; ring.rotation.y = angle;
      }
      this.sparks(x, y, r * .6, p, color, 5);
    } else {
      this.mesh('ball', color, fade * .3, [x, 15, y], [r * pulse * .45 + 1, 10 + pulse * 22, r * pulse * .45 + 1]);
      this.sparks(x, y, r, p, color);
    }
    // Immediate events flash immediately; visual progress never postpones gameplay impact.
    if (p < .22) this.mesh('ball', '#fff6d9', (1 - p / .22) * .65, [x, 20, y], [r * .18, r * .18, r * .18]);
  }

  update(projectiles: readonly AbilityProjectile[], spells: readonly AbilitySpell[], second: number,
    sources: readonly AbilitySource[],impacts:readonly WeaponImpact[]=[]) {
    this.used = 0;
    this.launches.begin(second,new Set(projectiles.map(p=>p.id)));
    if(second<this.lastSecond)this.weaponTrails.clear();
    this.lastSecond=second;
    for (const event of spells) {
      let s = event;
      if (s.duration <= 0) continue;
      // The actor itself becomes the travelling ball; only a real arrival may burst.
      if(s.type==='ball_lightning')continue;
      const source = s.sourceUnitId ? sources.find(unit => unit.id === s.sourceUnitId) :
        sources.find(unit=>!!s.avatarName&&unit.champion?.name===s.avatarName&&s.sourceX!==undefined&&s.sourceY!==undefined&&Math.hypot(unit.x-s.sourceX,unit.y-s.sourceY)<60);
      // Channel events can outlive an interrupted channel in the simulation's visual-event list.
      // Read the live state before drawing either its footprint or its particles.
      if (s.sourceUnitId && ['black_hole','broadside_channel','cyclone_dance','branch_court'].includes(s.type ?? '')) {
        const state = s.type === 'black_hole' ? source?.blackHole : s.type === 'broadside_channel' ? source?.corsaraBarrage :
          s.type === 'cyclone_dance' ? source?.monkeySpin : source?.monkeyCourt;
        if (!state || state.remaining <= 0 || source?.isAlive === false) continue;
        if (s.type === 'black_hole' && source?.blackHole) s = { ...s, x: source.blackHole.x, y: source.blackHole.y };
        if (s.type === 'branch_court' && source?.monkeyCourt) s = { ...s, x: source.monkeyCourt.x, y: source.monkeyCourt.y };
        if (s.type === 'cyclone_dance' && source) s = { ...s, x: source.x, y: source.y };
        if (s.type === 'broadside_channel' && source?.corsaraBarrage) {
          const direction = source.corsaraBarrage.facing === 'right' ? 1 : -1, color = s.color;
          // Match forward <=260, abs(lateral)<=forward*.55+24 in the existing combat rule.
          for (const sign of [-1, 1]) this.beam([source.x, 2, source.y + sign * 24], [source.x + direction * 260, 2, source.y + sign * 167], color, 1, .6);
          this.beam([source.x + direction * 260, 2, source.y - 167], [source.x + direction * 260, 2, source.y + 167], color, 1, .6);
          drawSpellDetail(this.details, s, 0, second, 1, source);
          continue;
        }
      }
      if (s.targetUnitId && /link|lash|vortex|death_mark|shallow_grave/.test(s.type ?? '')) {
        const target = sources.find(unit => unit.id === s.targetUnitId);
        if (target?.isAlive === false || source?.isAlive === false) continue;
        if (target) s = { ...s, x: target.x, y: target.y };
      }
      const p = THREE.MathUtils.clamp(1 - s.duration / Math.max(.01, s.maxDuration), 0, 1), fade = Math.min(1, (1 - p) * 2.2);
      const warning = /warning|telegraph/.test(s.type ?? '');
      const evolution=source?.visualEvolution;
      if(!warning&&evolution?.version===1&&[evolution.facet_count,evolution.accent_height].every(Number.isFinite)&&!s.halfWidth&&!s.halfHeight) {
        // Decorative facets stay inside the existing event outline and lifetime,
        // including Arsenaldo's invoked spells. They never produce hit events.
        const count=Math.max(0,Math.min(5,Math.floor(evolution.facet_count))),radius=Math.max(0,s.radius)*.32;
        for(let i=0;i<count;i++){const a=i*Math.PI*2/Math.max(1,count)+p*.6;
          const facet=this.mesh('shard',s.color,fade*.35,[s.x+Math.cos(a)*radius,Math.max(1,Math.min(5,evolution.accent_height))*Math.sin(p*Math.PI)+2,s.y+Math.sin(a)*radius],[.7,1.5,.7]);facet.rotation.y=a;
        }
      }
      if (this.invoked(s, second)) continue;
      // Exact footprints stay as outlines; opaque fills no longer cover the fight.
      if (s.halfWidth && s.halfHeight) {
        const w = s.halfWidth, h = s.halfHeight;
        for (const sign of [-1, 1]) {
          this.beam([s.x - w, 2, s.y + sign * h], [s.x + w, 2, s.y + sign * h], s.color, 1, fade * .6);
          this.beam([s.x + sign * w, 2, s.y - h], [s.x + sign * w, 2, s.y + h], s.color, 1, fade * .6);
        }
      } else this.ring(s.x, s.y, Math.max(3, s.radius), s.color, warning ? .8 : fade * .3);
      if (warning) { this.ring(s.x, s.y, Math.max(3, s.radius) * p, s.color, .9); continue; }
      const tip=source?.weaponSocket?.tip;
      const resolved = source ? { ...s, sourceX: tip?.[0]??source.x, sourceY: tip?.[2]??source.y,sourceHeight:tip?.[1] } : s;
      if (!drawSpellDetail(this.details, resolved, p, second, fade, source)) this.burst(resolved, abilityEffectStyle(s), p, second, fade);
    }
    for (const unit of sources) drawDashDetail(this.details, unit, second);
    for (const p of projectiles) this.projectile(p, second, sources.find(unit => unit.id === p.attackerId));
    const activeTrails=new Set<string>();
    for(const unit of sources){
      const socket=unit.weaponSocket,age=unit.attackAge;
      if(!socket||unit.isAlive===false||age===undefined||age<0||age>.2||!['blade','fist'].includes(socket.style))continue;
      activeTrails.add(unit.id);
      const history=this.weaponTrails.get(unit.id)??[];
      if(history.length===0||history[history.length-1].second!==second)history.push({second,tip:[...socket.tip]});
      const segments=unit.visualEvolution?.version===1&&Number.isFinite(unit.visualEvolution.trail_segments)?Math.max(3,Math.min(6,unit.visualEvolution.trail_segments)):6;
      while(history.length>segments||history[0].second<second-.08)history.shift();
      this.weaponTrails.set(unit.id,history);
      const finish=AVATAR_WEAPON_FINISH[socket.avatarId??'']??'steel',color=WEAPON_FINISH_COLORS[finish],fade=(1-age/.2)*.65;
      this.beam(socket.base,socket.tip,color,socket.style==='fist'?2:1,fade);
      for(let i=1;i<history.length;i++)this.beam(history[i-1].tip,history[i].tip,color,1.2,fade*i/history.length);
    }
    for(const impact of impacts){
      if(impact.age<0||impact.age>.28)continue;
      const finish=AVATAR_WEAPON_FINISH[impact.avatarId]??'steel',color=WEAPON_FINISH_COLORS[finish];
      const t=impact.age/.28,fade=(1-t)**2,height=impact.kind==='melee'?24:27;
      for(let i=0;i<5;i++){
        const a=i*2.399,reach=3+t*(finish==='earth'?17:12),px=impact.x+Math.cos(a)*reach,pz=impact.y+Math.sin(a)*reach;
        const shape=finish==='ink'||finish==='void'?'ball':'shard';
        const chip=this.mesh(shape,color,fade*.85,[px,height+Math.sin(t*Math.PI)*(4+i),pz],finish==='earth'?[1.6,1.4,1.6]:[.65,3*(1-t)+.3,.65],finish!=='earth');
        chip.rotation.set(a,t*4,a*.3);
      }
      if(finish==='storm')this.lightning([impact.x-7,height,impact.y],[impact.x+7,height+7,impact.y],color,fade,second,.8);
      if(finish==='fist'||finish==='powder'||finish==='rocket')this.mesh('ball',color,fade*.35,[impact.x,height,impact.y],[3+6*t,3+6*t,3+6*t]);
    }
    for(const id of this.weaponTrails.keys())if(!activeTrails.has(id))this.weaponTrails.delete(id);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
    this.flushGlow();
  }
  private flushGlow() {
    const groups = new Map<THREE.BufferGeometry, THREE.Mesh[]>();
    for (let i = 0; i < this.used; i++) {
      const mesh = this.pool[i];
      if (!mesh.visible || mesh.parent !== this.owner) continue;
      const group = groups.get(mesh.geometry) ?? []; group.push(mesh); groups.set(mesh.geometry, group);
    }
    for (const batch of this.batches.values()) batch.count = 0;
    for (const [geometry, meshes] of groups) {
      let batch = this.batches.get(geometry);
      if (!batch || batch.instanceMatrix.count < meshes.length) {
        if (batch) { this.root.remove(batch); batch.dispose(); }
        const capacity = 2 ** Math.ceil(Math.log2(Math.max(64, meshes.length)));
        batch = new THREE.InstancedMesh(geometry, geometry === this.geometry.arc ? this.arcGlowMaterial : this.glowMaterial, capacity);
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.frustumCulled = false;
        batch.name = 'ability-glow-batch'; this.batches.set(geometry, batch); this.root.add(batch);
      }
      batch.count = meshes.length;
      meshes.forEach((mesh, i) => {
        mesh.updateMatrix(); batch!.setMatrixAt(i, mesh.matrix);
        const material = mesh.material as THREE.MeshBasicMaterial;
        batch!.setColorAt(i, this.instanceColor.copy(material.color).multiplyScalar(material.opacity * .72));
      });
      batch.instanceMatrix.needsUpdate = true; if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }
  }
  stats() { return { effects: this.used, pooledEffects: this.pool.length }; }
}
