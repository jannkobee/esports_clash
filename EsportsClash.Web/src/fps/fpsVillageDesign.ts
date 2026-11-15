import type { LiveSurface } from './fpsLiveGraphics.ts';
import {LIVE_WINDOW_FURNITURE} from './fpsMidWindowInterior.ts';

export interface VillageAsset { purpose:string; kind:'house'|'shop'|'civic'|'clock'|'wall'|'pier'|'counter'|'timber'|'bench'|'fountain'|'gallery'|'tree'|'bin'; color:string; surface:LiveSurface }
const asset=(purpose:string,kind:VillageAsset['kind'],color:string,surface:LiveSurface='plaster'):VillageAsset=>({purpose,kind,color,surface});
/** Stable collision IDs retain compatibility; every rendered volume has a village purpose. */
export const VILLAGE_ASSETS:Record<string,VillageAsset>={
  'west-wall':asset('Residential garden boundary','wall','#b9ad92','stone'),
  'east-wall':asset('Residential garden boundary','wall','#c6b99d','stone'),
  'north-wall':asset('Civic courtyard boundary','wall','#c6b99d','stone'),
  'south-wall':asset('Village arrival gate boundary','wall','#b9ad92','stone'),
  'loading-office':asset('Village inn west wing','house','#d8b47c'),
  'pump-house':asset('Village inn east wing','house','#c47e64'),
  'mid-approach-screen':asset('Arrival information kiosk','shop','#dfd6c2'),
  'mid-west-lower':asset('Pompeian red Pizzeria Rusticanella','shop','#b85242'),
  'mid-west-upper':asset('Saffron-ochre Farmacia and bakery residence','shop','#d8a860'),
  'apartments-south':asset('Weathered whitewashed Albergo corner hotel','house','#e2dac6'),
  'apartments-north':asset('Limestone town-hall administration annex','civic','#d4c3a3'),
  'customs-warehouse-east':asset('Saffron-ochre Formaggi market house','shop','#d6a662'),
  'freight-office-east':asset('Apricot-terracotta market grocers and homes','shop','#cf8d68'),
  'b-logs':asset('Bakery firewood store','timber','#92704c','timber'),
  'b-car':asset('Closed street-market shop kiosk','shop','#d4c8ae'),
  'b-sandbags':asset('Market produce counter','counter','#a17c50','timber'),
  'west-container':asset('Village carpentry workshop','shop','#c99b74'),
  'east-container':asset('Tall Venetian market residences over shops','shop','#c98566'),
  'west-outer-gate':asset('Residential lane boundary','wall','#b9ad92','stone'),
  'east-outer-gate':asset('Market lane boundary','wall','#c6b99d','stone'),
  'west-lane-dogleg':asset('Inn rear service shed','shop','#cfc3aa','stone'),
  'east-lane-dogleg':asset('Residential terrace planted retaining bay','counter','#c8b898','stone'),
  'west-staging-cover':asset('Inn linen and maintenance store','shop','#cfc0a0'),
  'east-staging-cover':asset('Bakery flour store','shop','#cbb38a'),
  'a-generator':asset('Civic records kiosk','civic','#ccc0a4'),
  'a-pit-revetment':asset('Town-hall courtyard bench','bench','#896b47','timber'),
  'a-crates':asset('Municipal stone campanile clock tower','clock','#dfd4bc','stone'),
  'a-screen':asset('Town-hall clerks wing','civic','#d6ccb6'),
  'a-retake-cover':asset('Civic maintenance store','civic','#cfc3a8'),
  'a-loggia-wall':asset('Pale limestone Palazzo Comunale assembly hall','civic','#ded5c0'),
  'b-fountain':asset('Public gathering fountain','fountain','#b8ac91','stone'),
  'b-coffins':asset('Flower seller kiosk','shop','#b9856a'),
  'b-screen':asset('Casa Dolce Vigna plaster residence','house','#dcd3be'),
  'b-dark-wall':asset('Ochre grocer residence','shop','#cfa16b'),
  'b-retake-cover':asset('Fountain pump and market store','shop','#c99672'),
  'mid-backstop':asset('Village square notice kiosk','civic','#d3c6a8'),
  'north-divider':asset('Civic guardhouse','civic','#d0c2a6'),
  'b-apartments-back':asset('Warm terracotta market apartments','house','#d29a78'),
};
export function liveVillageAsset(id:string):VillageAsset {
  const furniture=LIVE_WINDOW_FURNITURE.find(item=>item.id===id);
  if(furniture)return asset(furniture.purpose,furniture.kind,furniture.color,'timber');
  if(id.startsWith('mid-window-')&&id.endsWith('roof'))return asset('CT customs lookout and annex terracotta roof','gallery','#a66b4d','clay');
  if(id==='mid-window-side-passage-floor'||id.startsWith('mid-window-side-stair-')||id.startsWith('mid-window-side-cheek-'))return asset('Civic annex passage and gentle stone access stairs','gallery','#c0ad8d','stone');
  if(id==='mid-window-room-floor'||id.startsWith('mid-window-rear-stair-'))return asset('CT customs lookout floor and grounded access stairs','gallery','#c0ad8d','stone');
  if(id.startsWith('mid-window-stair-cheek-'))return asset('CT customs lookout stair parapet and retaining stone','gallery','#b2a085','stone');
  if(id.startsWith('mid-window-'))return asset('CT customs lookout masonry with a genuine open window','gallery','#ba8068','plaster');
  if(id==='b-canal-house')return asset('Rose plaster canal-side merchant house','house','#c47b6b');
  if(id==='b-market-west-house')return asset('Sunlit yellow-ochre market-lane residence','house','#dbb065');
  if(id==='b-sottoportego')return asset('Low covered market entrance between admitted houses','gallery','#c6b99d','stone');
  if(id.startsWith('port-customs-'))return asset('Port customs and harbor-master offices','shop','#d5cab0');
  if(id.startsWith('port-'))return asset('CT customs quay stone harbor edge','wall','#b4aa8d','stone');
  if(id.startsWith('bridge-'))return asset('Compact masonry canal bridge and parapet','wall','#a47d64','stone');
  if(id.startsWith('canal-'))return asset('Urban canal towpath and dressed retaining stone','wall','#959981','stone');
  if(id==='restaurant-teal-awning')return asset('Jade Lantern tiled entrance eave','gallery','#477c72','clay');
  if(id.startsWith('restaurant-outside-table')||id==='restaurant-menu-stand')return asset('Jade Lantern street dining furniture','counter','#806347','timber');
  if(id==='restaurant-roof')return asset('Jade Lantern clay-tile roof','gallery','#a97451','clay');
  if(id==='restaurant-service-counter')return asset('Jade Lantern kitchen service counter','counter','#806347','timber');
  if(id.startsWith('restaurant-table'))return asset('Jade Lantern dining table','counter','#806347','timber');
  if(id.startsWith('restaurant-'))return asset('Jade Lantern structural wall with open exits','wall','#bba283','stone');
  if(id.startsWith('mid-catwalk-rail'))return asset('Raised market crossing guardrail','gallery','#a68c63','timber');
  if(id.startsWith('mid-catwalk-beam'))return asset('Market crossing structural beam','pier','#927653','timber');
  if(id.startsWith('mid-catwalk-pier'))return asset('Market crossing support post','pier','#a68c63','timber');
  if(VILLAGE_ASSETS[id])return VILLAGE_ASSETS[id];
  if(id.startsWith('market-stall-'))return asset('Public market vendor counter','counter','#a9875c','timber');
  if(id.startsWith('market-canopy-'))return asset('Supported striped market canopy','gallery','#c8b284');
  if(id.startsWith('market-post-'))return asset('Market canopy timber support','pier','#8c7651','timber');
  if(id.startsWith('village-tree-'))return asset('Village shade tree','tree','#6b5840','timber');
  if(id.startsWith('village-bin-'))return asset('Municipal street litter bin','bin','#536d65','metal');
  if(id==='market-residential-wing')return asset('Inn-to-market residential terrace','house','#c6aa87');
  if(id.startsWith('market-gallery-'))return asset('Residential promenade parapet','gallery','#cfc1a2','stone');
  if(id.startsWith('south-wall-')||id.startsWith('north-wall-')||id.startsWith('west-wall-')||id.startsWith('east-wall-'))return asset('Open village street entrance','wall','#b9ad92','stone');
  if(id.startsWith('spawn-bench'))return asset('Spawn courtyard storage bench',id.endsWith('-back')?'pier':'bench','#987d55','timber');
  if(/pillar|jamb|column/.test(id))return asset('Structural column or window pier','pier','#cfc1a2','stone');
  if(id.startsWith('b-apartments-'))return asset('Market apartment gallery','gallery','#cfc1a2','stone');
  throw Error(`Village asset has no purpose: ${id}`);
}
