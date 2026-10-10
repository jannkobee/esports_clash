export type CastSlot = 'skill1' | 'skill2' | 'ultimate';
export type InsightKind = 'cast' | 'hit' | 'mana' | 'channel' | 'jaunt' | 'decision';

export interface InsightEvent {
  second: number;
  kind: InsightKind;
  text: string;
  actorId?: string;
}

export interface AvatarInsight {
  id: string;
  player: string;
  avatar: string;
  team: 'blue' | 'red';
  casts: Record<CastSlot, number>;
  skillshotsFired: number;
  skillshotsHit: number;
  manaBlocks: number;
  blackHoleInterrupts: number;
  engageJaunts: number;
  escapeJaunts: number;
  lastManaBlockAt?: Partial<Record<CastSlot, number>>;
}

export interface MatchInsights {
  players: Record<string, AvatarInsight>;
  timeline: InsightEvent[];
}

export type InsightActor = { id: string; team: 'blue' | 'red'; player: { name: string }; champion: { name: string } };

export const createMatchInsights = (): MatchInsights => ({ players: {}, timeline: [] });

function avatar(insights: MatchInsights, actor: InsightActor): AvatarInsight {
  return insights.players[actor.id] ??= {
    id: actor.id, player: actor.player.name, avatar: actor.champion.name, team: actor.team,
    casts: { skill1: 0, skill2: 0, ultimate: 0 }, skillshotsFired: 0, skillshotsHit: 0,
    manaBlocks: 0, blackHoleInterrupts: 0, engageJaunts: 0, escapeJaunts: 0
  };
}

export function addInsightEvent(insights: MatchInsights, event: InsightEvent): void {
  insights.timeline.push({ ...event, second: Math.round(event.second * 100) / 100 });
  if (insights.timeline.length > 1200) insights.timeline.splice(0, insights.timeline.length - 1200);
}

export function recordAbilityCast(insights: MatchInsights, actor: InsightActor, slot: CastSlot, second: number): void {
  avatar(insights, actor).casts[slot]++;
  addInsightEvent(insights, { second, kind: 'cast', actorId: actor.id,
    text: `${actor.player.name} (${actor.champion.name}) cast ${slot === 'ultimate' ? 'Ultimate' : slot === 'skill1' ? 'Skill 1' : 'Skill 2'}` });
}

export function recordSkillshot(insights: MatchInsights, actor: InsightActor, hit: boolean, second: number): void {
  const stats = avatar(insights, actor);
  if (hit) stats.skillshotsHit++;
  else stats.skillshotsFired++;
  if (hit) addInsightEvent(insights, { second, kind: 'hit', actorId: actor.id,
    text: `${actor.player.name}'s skillshot hit` });
}

export function recordManaBlock(insights: MatchInsights, actor: InsightActor, slot: CastSlot,
  second: number, needed: number): void {
  const stats = avatar(insights, actor);
  const last = stats.lastManaBlockAt?.[slot];
  if (last !== undefined && second - last < 5) return;
  (stats.lastManaBlockAt ??= {})[slot] = second;
  stats.manaBlocks++;
  addInsightEvent(insights, { second, kind: 'mana', actorId: actor.id,
    text: `${actor.player.name} lacked ${Math.ceil(needed)} mana for ${slot === 'ultimate' ? 'Ultimate' : slot === 'skill1' ? 'Skill 1' : 'Skill 2'}` });
}

export function recordBlackHoleInterrupt(insights: MatchInsights, actor: InsightActor, second: number): void {
  avatar(insights, actor).blackHoleInterrupts++;
  addInsightEvent(insights, { second, kind: 'channel', actorId: actor.id,
    text: `${actor.player.name}'s Black Hole was interrupted` });
}

export function recordPaxiJaunt(insights: MatchInsights, actor: InsightActor, second: number,
  purpose: 'engage' | 'escape'): void {
  const stats = avatar(insights, actor);
  if (purpose === 'escape') stats.escapeJaunts++;
  else stats.engageJaunts++;
  addInsightEvent(insights, { second, kind: 'jaunt', actorId: actor.id,
    text: `${actor.player.name} jaunted to ${purpose === 'escape' ? 'escape' : 'engage'}` });
}
