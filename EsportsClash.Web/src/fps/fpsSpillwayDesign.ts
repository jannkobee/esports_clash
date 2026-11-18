import type { LiveSurface } from './fpsLiveGraphics.ts';
import type { LiveSurfaceAcoustic } from './fpsSpatialWorld.ts';

export interface SpillwayAssetSpec {
  purpose: string;
  surface: LiveSurface;
  acoustic: LiveSurfaceAcoustic;
  color: string;
}

const CONCRETE_WALL = '#a4a6a2';
const CONCRETE_DARK = '#7c8183';
const RETAINING = '#8d908b';
const BRICK_PATH = '#a66b56';
const KIOSK_WALL = '#cdb899';
const METAL_RAIL = '#d7b239';
const PUMP_BLUE = '#2f6b9a';
const PLANTER = '#7b7467';
const TIMBER = '#886747';
const TUNNEL_VAULT = '#72787d';

const EXACT_ASSETS: Record<string, SpillwayAssetSpec> = {
  'gardens-pergola-roof': { purpose: 'Park pergola timber beams', surface: 'timber', acoustic: 'wood', color: '#7d5b3e' },
  'gardens-fountain': { purpose: 'Upper park ornamental basin', surface: 'stone', acoustic: 'stone', color: '#9aa3a0' },
  'parkhouse-west': { purpose: 'Restroom & parkhouse west block', surface: 'clay', acoustic: 'brick', color: '#b4947a' },
  'parkhouse-east': { purpose: 'Restroom & parkhouse east wing', surface: 'clay', acoustic: 'brick', color: '#c4ab8d' },
  'kiosk-south-wall': { purpose: 'A Short tourist kiosk counter facade', surface: 'plaster', acoustic: 'wood', color: KIOSK_WALL },
  'kiosk-north-wall': { purpose: 'A Short tourist kiosk north wall', surface: 'plaster', acoustic: 'wood', color: KIOSK_WALL },
  'kiosk-roof': { purpose: 'Kiosk copper-grey standing seam roof', surface: 'metal', acoustic: 'metal', color: '#58676b' },
  'a-response-truck': { purpose: 'Flood response utility van on A', surface: 'metal', acoustic: 'metal', color: '#395569' },
  'a-control-box': { purpose: 'HQ telemetry electrical cabinet', surface: 'metal', acoustic: 'metal', color: '#586970' },
  'a-flood-barrier': { purpose: 'Concrete Jersey flood barrier on A', surface: 'concrete', acoustic: 'concrete', color: '#9ea19c' },
  'a-dice-crate': { purpose: 'HQ Sandbagged supply crate', surface: 'timber', acoustic: 'wood', color: '#9b7b54' },
  'a-site-pallet': { purpose: 'A Site jumpable timber equipment pallet', surface: 'timber', acoustic: 'wood', color: '#9a784e' },
  'ct-security-van': { purpose: 'Municipal security van in CT Compound', surface: 'metal', acoustic: 'metal', color: '#d2d4cf' },
  'ct-barrier-hut': { purpose: 'CT security checkpoint booth', surface: 'concrete', acoustic: 'concrete', color: '#8f9699' },
  't-service-truck': { purpose: 'Flood maintenance flatbed truck in T Yard', surface: 'metal', acoustic: 'metal', color: '#c9853b' },
  'yard-crate-perch': { purpose: 'Service yard jumpable supply crate', surface: 'timber', acoustic: 'wood', color: '#94744e' },
  'b-silo-pillar': { purpose: 'Central pumping station pressure cylinder', surface: 'concrete', acoustic: 'concrete', color: '#8f9698' },
  'b-pump-west': { purpose: 'Twin blue turbine pump (west)', surface: 'metal', acoustic: 'metal', color: PUMP_BLUE },
  'b-pump-east': { purpose: 'Twin blue turbine pump (east)', surface: 'metal', acoustic: 'metal', color: PUMP_BLUE },
  'b-flood-bags': { purpose: 'Emergency flood sandbag bunker', surface: 'plaster', acoustic: 'stone', color: '#a58c68' },
  'b-east-cabinet': { purpose: 'Hydro-valve steel control cabinet', surface: 'metal', acoustic: 'metal', color: '#3f6880' },
  'b-retake-crate': { purpose: 'Pumping station jumpable maintenance crate', surface: 'timber', acoustic: 'wood', color: '#967752' },
  'b-divider-house': { purpose: 'Waterworks divider turbine house', surface: 'concrete', acoustic: 'concrete', color: '#878e90' },
  'b-short-sandbags': { purpose: 'Short canal defensive sandbag wall', surface: 'plaster', acoustic: 'stone', color: '#9d8768' },
  'canal-utility-box': { purpose: 'Jumpable canal sluice valve housing', surface: 'metal', acoustic: 'metal', color: PUMP_BLUE },
  'mid-planter-bench': { purpose: 'Mid park stone planter bench', surface: 'stone', acoustic: 'stone', color: '#959184' },
  'party-plaza-planter': { purpose: 'Plaza corner masonry party planter', surface: 'stone', acoustic: 'stone', color: '#979184' },
  'party-table-west': { purpose: 'Mid Party terrace timber picnic table', surface: 'timber', acoustic: 'wood', color: '#946e48' },
  'party-arch-pillar': { purpose: 'Party terrace festive column', surface: 'stone', acoustic: 'stone', color: '#a29b8e' },
  'gardens-playground-frame': { purpose: 'Gardens playground timber climbing fort', surface: 'timber', acoustic: 'wood', color: '#b47442' },
  'long-boulder-rock': { purpose: 'Promenade landscaped granite boulder', surface: 'stone', acoustic: 'stone', color: '#838784' },
  'long-picnic-table': { purpose: 'Promenade timber picnic bench', surface: 'timber', acoustic: 'wood', color: '#8f6944' },
  'long-boost-crate': { purpose: 'Promenade jumpable maintenance crate', surface: 'timber', acoustic: 'wood', color: '#95754e' },
  'a-headshot-planter': { purpose: 'A Long headshot-height masonry planter', surface: 'stone', acoustic: 'stone', color: '#8e8a7f' },
  'a-flowers-sign': { purpose: 'A Short park directory sign & flowerbed', surface: 'metal', acoustic: 'metal', color: '#395569' },
  'a-bins-dumpster': { purpose: 'HQ roadway municipal steel dumpster', surface: 'metal', acoustic: 'metal', color: '#3b6457' },
  'a-bank-van': { purpose: 'Hydrology Bank security transport van', surface: 'metal', acoustic: 'metal', color: '#d0d3ce' },
  'a-bank-counter': { purpose: 'Hydrology Bank interior teller counter', surface: 'timber', acoustic: 'wood', color: '#87684b' },
  'b-barrels-cluster': { purpose: 'Pumping station hydro-chemical drum stack', surface: 'metal', acoustic: 'metal', color: '#2f6b9a' },
  'b-jail-pillar': { purpose: 'B East maintenance cage equipment block', surface: 'concrete', acoustic: 'concrete', color: '#7e868a' },
  'control-deck-slab': { purpose: 'Cantilevered steel control deck balcony', surface: 'concrete', acoustic: 'metal', color: CONCRETE_DARK },
  'control-deck-booth': { purpose: 'Glassless floodgate observation booth', surface: 'metal', acoustic: 'metal', color: '#5c6b70' },
};

export function resolveSpillwayAsset(id: string): SpillwayAssetSpec {
  const exact = EXACT_ASSETS[id];
  if (exact) return exact;
  if (id.includes('rail')) return { purpose: 'Yellow municipal safety railing', surface: 'metal', acoustic: 'metal', color: METAL_RAIL };
  if (id.includes('pump') || id.includes('pipe') || id.includes('valve')) return { purpose: 'Blue flood control machinery', surface: 'metal', acoustic: 'metal', color: PUMP_BLUE };
  if (id.includes('planter')) return { purpose: 'Landscaped masonry park planter', surface: 'stone', acoustic: 'stone', color: PLANTER };
  if (id.includes('crate') || id.includes('pallet') || id.includes('pergola') || id.includes('bench') || id.includes('picnic')) return { purpose: 'Timber street furniture or crate', surface: 'timber', acoustic: 'wood', color: TIMBER };
  if (id.includes('tree')) return { purpose: 'Urban riverside park tree trunk', surface: 'timber', acoustic: 'wood', color: '#614e3a' };
  if (id.includes('tunnel') || id.includes('culvert') || id.includes('ceiling') || id.includes('squeaky')) return { purpose: 'Vaulted concrete drainage culvert', surface: 'concrete', acoustic: 'concrete', color: TUNNEL_VAULT };
  if (id.includes('parkhouse')) return { purpose: 'Parkhouse restroom pavilion wall', surface: 'clay', acoustic: 'brick', color: '#bfa284' };
  if (id.includes('bank')) return { purpose: 'Municipal Hydrology Bank masonry', surface: 'concrete', acoustic: 'concrete', color: '#9ca1a3' };
  if (id.includes('jail')) return { purpose: 'Maintenance cage barrier wall', surface: 'concrete', acoustic: 'concrete', color: '#7f868a' };
  if (id.includes('bridge')) return { purpose: 'Canal steel truss footbridge', surface: 'metal', acoustic: 'metal', color: '#5b666b' };
  if (id.includes('kiosk') || id.includes('promenade')) return { purpose: 'Park promenade brick pavilion', surface: 'clay', acoustic: 'brick', color: BRICK_PATH };
  if (id.includes('retaining') || id.includes('cliff') || id.includes('spine') || id.includes('pier')) return { purpose: 'Weathered concrete retaining wall', surface: 'concrete', acoustic: 'concrete', color: RETAINING };
  if (id.includes('roof') || id.includes('overpass')) return { purpose: 'Overpass concrete roof structure', surface: 'concrete', acoustic: 'concrete', color: CONCRETE_DARK };
  if (/-patch-\d+/.test(id)) return { purpose: 'Flood-control terrain and retaining patch', surface: 'concrete', acoustic: 'concrete', color: CONCRETE_WALL };
  return { purpose: 'Municipal flood control masonry wall', surface: 'concrete', acoustic: 'concrete', color: CONCRETE_WALL };
}
