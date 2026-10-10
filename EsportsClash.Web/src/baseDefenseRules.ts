type Position = { x: number; y: number };
type Team = 'blue' | 'red';
type Threat = Position & { id: string; team: Team; isAlive: boolean };
type Building = Threat & { type: string; hp: number; maxHp: number; range: number };

const HOME_EMERGENCIES = new Set(['nexus', 'nexus_tower', 'barracks']);
const PRIORITY: Record<string, number> = {
  nexus: 100, nexus_tower: 80, barracks: 70, inner_tower: 35, outer_tower: 20,
};

// Visible/scouted champions and publicly observable lane creeps are the ONLY
// threat inputs. A damaged building by itself is not evidence of an attack.
// Retain a small detection margin on the current defense to avoid edge jitter;
// never retain a call after its attackers and siege wave have gone away.
export function chooseBaseDefense<T extends Building>(
  actor: Position & { team: Team }, buildings: readonly T[],
  visibleEnemies: readonly Threat[], minions: readonly Threat[], previousBuildingId?: string,
) {
  const owned = buildings.filter(building => building.team === actor.team && building.isAlive);
  const radiusFor = (building: T, wave: boolean) => Math.max(building.range + 100,
    HOME_EMERGENCIES.has(building.type) ? 285 : 245)
    + (previousBuildingId === building.id ? 35 : 0) - (wave ? 45 : 0);
  // Towers, barracks and Nexus have overlapping detection circles. Assign a
  // threat to the closest *living* building so a tower siege cannot masquerade
  // as a direct Nexus hit and pull defenders behind the wrong structure.
  const isNearestThreatenedBuilding = (threat: Threat, building: T, wave: boolean) => {
    const distance = Math.hypot(threat.x - building.x, threat.y - building.y);
    if (distance > radiusFor(building, wave)) return false;
    return !owned.some(other => {
      if (other.id === building.id) return false;
      const otherDistance = Math.hypot(threat.x - other.x, threat.y - other.y);
      return otherDistance <= radiusFor(other, wave)
        && (otherDistance < distance - 0.001 || (Math.abs(otherDistance - distance) <= 0.001
          && (PRIORITY[other.type] ?? 0) > (PRIORITY[building.type] ?? 0)));
    });
  };
  return owned.map(building => {
      const urgent = HOME_EMERGENCIES.has(building.type);
      const critical = building.type === 'nexus';
      const attackers = visibleEnemies.filter(enemy => enemy.isAlive && enemy.team !== actor.team
        && isNearestThreatenedBuilding(enemy, building, false));
      const wave = minions.filter(enemy => enemy.isAlive && enemy.team !== actor.team
        && isNearestThreatenedBuilding(enemy, building, true));
      const distance = Math.hypot(actor.x - building.x, actor.y - building.y);
      const damagedFraction = building.maxHp > 0
        ? Math.max(0, Math.min(1, 1 - building.hp / building.maxHp)) : 0;
      const priority = PRIORITY[building.type] ?? 0;
      return {
        building, urgent, critical, attackers, wave, distance,
        score: priority + damagedFraction * 10 + Math.min(8, attackers.length * 2 + wave.length),
        rally: { x: building.x + (actor.team === 'blue' ? -65 : 65), y: building.y },
      };
    })
    .filter(call => (call.attackers.length > 0 || call.wave.length > 0)
      && (call.urgent || call.distance <= 650))
    .sort((a, b) => b.score - a.score || a.distance - b.distance
      || a.building.id.localeCompare(b.building.id))[0];
}

type DefenseCall = { urgent: boolean; critical: boolean } | undefined;

// A real fight loss, tower-fire evacuation or very low HP still beats a defense
// call. Otherwise a threatened base must interrupt optional shopping/farming.
export function shouldStandAndDefendBase(call: DefenseCall, state: {
  healthFraction: number; losingFight: boolean; outnumbered: boolean;
  diveAborting: boolean; takingTurretFire: boolean;
}): boolean {
  if (!call || state.losingFight || state.diveAborting || state.takingTurretFire) return false;
  const minimumHp = call.critical ? 0.32 : call.urgent ? 0.40 : 0.47;
  return state.healthFraction >= minimumHp && (!state.outnumbered || state.healthFraction >= 0.65);
}

// Staying in the well until 95% HP is wasteful when the Nexus is falling.
// Do not send wounded champions out at near-zero mana in a base emergency.
export function shouldLeaveWellToDefend(call: DefenseCall, state: {
  healthFraction: number; manaFraction: number;
}): boolean {
  return !!call?.urgent && state.healthFraction >= (call.critical ? 0.65 : 0.75)
    && state.manaFraction >= 0.20;
}

// For a distant defender, a safe 2.5s recall can beat walking across the map.
// Compare complete routes, not just distance to the threatened building.
export function shouldRecallToDefendBase(call: DefenseCall, state: {
  position: Position; rally: Position; well: Position;
  movementSpeed: number; channelSeconds: number; canChannel: boolean;
}): boolean {
  if (!call?.urgent || !state.canChannel || state.movementSpeed <= 0) return false;
  const direct = Math.hypot(state.position.x - state.rally.x, state.position.y - state.rally.y)
    / state.movementSpeed;
  const teleport = state.channelSeconds + Math.hypot(state.well.x - state.rally.x,
    state.well.y - state.rally.y) / state.movementSpeed;
  // Enough of a margin to avoid a 30Hz move/recall flip near the boundary.
  return direct > teleport + 0.75;
}

export function shouldInterruptRecallForDefense(call: DefenseCall, state: {
  position: Position; rally: Position; well: Position;
  movementSpeed: number; channelRemaining: number; healthy: boolean;
}): boolean {
  if (!call?.urgent || !state.healthy || state.movementSpeed <= 0) return false;
  const direct = Math.hypot(state.position.x - state.rally.x, state.position.y - state.rally.y)
    / state.movementSpeed;
  const finishRecall = Math.max(0, state.channelRemaining) + Math.hypot(state.well.x - state.rally.x,
    state.well.y - state.rally.y) / state.movementSpeed;
  return direct + 0.25 < finishRecall;
}
