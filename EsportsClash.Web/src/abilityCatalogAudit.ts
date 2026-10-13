import type { ChampionKit } from './types';
import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities';
import { getAbilityPresentation, type AbilityDisplaySlot } from './abilityPresentation';

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
