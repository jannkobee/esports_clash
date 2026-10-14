import type { ChampionKit } from './types';
import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities.ts';
import { getAbilityPresentation, type AbilityDisplaySlot } from './abilityPresentation.ts';

export interface AbilityCatalogAudit {
  avatars: number;
  standardActives: number;
  passives: number;
  invokedAbilities: number;
  documentedActives: number;
  missingDescriptions: string[];
  movementAbilities: Array<{ champion: string; slot: AbilityDisplaySlot; kind: string }>;
}

const STANDARD_SLOTS: readonly AbilityDisplaySlot[] = ['skill1', 'skill2', 'ultimate'];

export type AbilityAuditStatus = 'code-reviewed' | 'requires-live-verification';

/**
 * A source-derived implementation inventory. It intentionally records where
 * the existing executor, VFX, audio and AI route live instead of mirroring
 * their mechanics in a second ability engine. "Code reviewed" means the
 * static data agrees with its presentation source; movement remains marked
 * for live verification until the deferred visual test pass is run.
 */
export interface AbilityAuditEntry {
  id: string;
  avatarId: string;
  avatar: string;
  kind: 'passive' | 'standard-active' | 'invoked';
  slot: string;
  name: string;
  description: string;
  targeting: string;
  damageType?: string;
  baseDamage?: number;
  range?: number;
  cooldown?: number;
  manaCost?: number;
  ranks: number;
  movement?: string;
  runtimeExecutor: string;
  vfxRoute: string;
  audioRoute: string;
  aiRoute: string;
  status: AbilityAuditStatus;
}

export function buildAbilityAuditMatrix(champions: readonly ChampionKit[]): AbilityAuditEntry[] {
  const entries: AbilityAuditEntry[] = [];
  champions.forEach(champion => {
    entries.push({
      id: `${champion.id}:passive`, avatarId: champion.id, avatar: champion.name,
      kind: 'passive', slot: 'passive', name: 'Innate Passive', description: champion.passiveDesc,
      targeting: 'Passive', ranks: 0, runtimeExecutor: 'match innate/passive handlers',
      vfxRoute: 'existing passive effect route', audioRoute: 'existing passive/audio trigger',
      aiRoute: 'always available; no active cast', status: 'code-reviewed',
    });
    STANDARD_SLOTS.forEach(slot => {
      const presentation = getAbilityPresentation(champion, slot);
      entries.push({
        id: presentation.key, avatarId: champion.id, avatar: champion.name,
        kind: 'standard-active', slot, name: presentation.name,
        description: presentation.shortDescription, targeting: presentation.castType,
        damageType: presentation.damage?.type, baseDamage: presentation.damage?.base,
        range: presentation.range, cooldown: presentation.cooldown, manaCost: presentation.manaCost,
        ranks: presentation.maxRank, movement: presentation.movement?.kind,
        runtimeExecutor: slot === 'skill1' ? 'castChampionSkill1' : slot === 'skill2' ? 'castChampionSkill2' : 'castChampionUltimate',
        vfxRoute: 'emitSkillEffect / authored spell or projectile state',
        audioRoute: 'sound.playAvatarSkill', aiRoute: 'existing combat ability selection',
        status: presentation.movement ? 'requires-live-verification' : 'code-reviewed',
      });
    });
  });
  KAELEN_INVOKED_SPELLS.forEach(spell => entries.push({
    id: `c_kaelen:invoked:${spell.id}`, avatarId: 'c_kaelen', avatar: 'Kaelen',
    kind: 'invoked', slot: 'D/F', name: spell.name, description: spell.description,
    targeting: spell.targeting, damageType: 'Magic', baseDamage: spell.damage,
    range: spell.range, cooldown: spell.cooldown, manaCost: spell.mana, ranks: 7,
    runtimeExecutor: 'castKaelenInvokedSpell / KaelenCast update',
    vfxRoute: 'kaelen_invoke spell state', audioRoute: 'sound.playAvatarSkill',
    aiRoute: 'processKaelenTurn', status: 'requires-live-verification',
  }));
  return entries;
}

/**
 * A deterministic source-data audit for the final regression test and report.
 * It deliberately inspects the same presentation adapter used by the dossier
 * and draft rather than duplicating ability metadata in a separate checklist.
 */
export function auditAbilityCatalog(champions: readonly ChampionKit[]): AbilityCatalogAudit {
  const missingDescriptions: string[] = [];
  const movementAbilities: AbilityCatalogAudit['movementAbilities'] = [];
  let documentedActives = 0;

  champions.forEach(champion => {
    STANDARD_SLOTS.forEach(slot => {
      const presentation = getAbilityPresentation(champion, slot);
      if (presentation.shortDescription.trim().length >= 12) documentedActives++;
      else missingDescriptions.push(`${champion.id}:${slot}`);
      if (presentation.movement) {
        movementAbilities.push({ champion: champion.name, slot, kind: presentation.movement.kind });
      }
    });
    if (champion.passiveDesc.trim().length < 12) missingDescriptions.push(`${champion.id}:passive`);
  });

  return {
    avatars: champions.length,
    standardActives: champions.length * STANDARD_SLOTS.length,
    passives: champions.length,
    invokedAbilities: KAELEN_INVOKED_SPELLS.length,
    documentedActives,
    missingDescriptions,
    movementAbilities,
  };
}
