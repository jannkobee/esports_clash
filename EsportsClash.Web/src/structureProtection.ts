import type {LaneStructure} from './types';
type Structure=Pick<LaneStructure,'team'|'type'|'isAlive'>;

/** Mechanical objective order, shared by live damage, target legality and tests. */
export function canDamageNexus(team:'blue'|'red',structures:readonly Structure[]):boolean{
  const defenders=structures.filter(s=>s.team===team),barracks=defenders.filter(s=>s.type==='barracks');
  return !defenders.some(s=>s.type.includes('tower')&&s.isAlive)
    &&barracks.length>=3&&barracks.every(s=>!s.isAlive);
}
export function canDamageStructure(target:Structure,structures:readonly Structure[]):boolean{
  if(!target.isAlive)return false;
  const defenders=structures.filter(s=>s.team===target.team);
  if(target.type==='outer_tower')return true;
  if(target.type==='inner_tower')return !defenders.some(s=>s.type==='outer_tower'&&s.isAlive);
  if(target.type==='nexus_tower')return !defenders.some(s=>['outer_tower','inner_tower'].includes(s.type)&&s.isAlive);
  if(target.type==='barracks')return !defenders.some(s=>s.type.includes('tower')&&s.isAlive);
  return canDamageNexus(target.team,structures);
}
export function structureProtectionReason(target:Structure,structures:readonly Structure[]):string|undefined{
  if(!target.isAlive)return 'Destroyed';
  if(canDamageStructure(target,structures))return;
  const defenders=structures.filter(s=>s.team===target.team&&s.isAlive);
  if(defenders.some(s=>s.type==='outer_tower'))return 'Outer turret first';
  if(defenders.some(s=>s.type==='inner_tower'))return 'Inner turret first';
  if(defenders.some(s=>s.type==='nexus_tower'))return 'Nexus turret first';
  const remaining=defenders.filter(s=>s.type==='barracks').length;
  return remaining?`${remaining} barracks remaining`:'Barracks required';
}
