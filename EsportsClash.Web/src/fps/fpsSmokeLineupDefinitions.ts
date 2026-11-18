import type {FpsPoint} from './fpsSpatialWorld.ts';

export interface LiveSmokeLineup {
  id:string;name:string;phase:'opening'|'execute'|'control';attacking:boolean;site:'A'|'B'|'Mid';
  position:FpsPoint;target:FpsPoint;mapId?:'fontessa'|'spillway';
}
/** Authored map knowledge, not observations of hidden enemies. Positions are
 * actual dry launch points; targets are useful crossings at their real floor. */
export const LIVE_AUTHORED_SMOKE_LINEUPS:readonly LiveSmokeLineup[]=[
  {id:'restaurant-civic',name:'Jade Lantern to civic entry',phase:'opening',attacking:true,site:'A',position:{x:-4.4,z:-27.6},target:{x:-19,z:7}},
  {id:'restaurant-market',name:'Jade Lantern to covered market entry',phase:'opening',attacking:true,site:'B',position:{x:4.4,z:-27.6},target:{x:20,z:8}},
  {id:'guard-civic',name:'Customs quay to civic entry',phase:'opening',attacking:false,site:'A',position:{x:-6,z:40},target:{x:-19,z:7}},
  {id:'guard-market',name:'Customs quay to market exit',phase:'opening',attacking:false,site:'B',position:{x:9,z:39},target:{x:20,z:13.5}},
  {id:'a-arch',name:'A main to civic arch',phase:'execute',attacking:true,site:'A',position:{x:-19,z:8},target:{x:-16,z:24}},
  {id:'a-library',name:'A outer to rear civic passage',phase:'execute',attacking:true,site:'A',position:{x:-29,z:9},target:{x:-11,z:30}},
  {id:'b-speedway',name:'Low market passage to flower crossing',phase:'execute',attacking:true,site:'B',position:{x:20,z:8},target:{x:18,z:25}},
  {id:'b-church',name:'Market forecourt to east return',phase:'execute',attacking:true,site:'B',position:{x:20,z:16},target:{x:27,z:29}},
  {id:'mid-window',name:'Mid lane into customs window',phase:'control',attacking:true,site:'Mid',position:{x:0,z:-14},target:{x:0,z:19.5}},
  {id:'mid-delay',name:'Customs return to bridge exit',phase:'control',attacking:false,site:'Mid',position:{x:-6,z:28},target:{x:0,z:11}},
];
