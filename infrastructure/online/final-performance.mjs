import assert from 'node:assert/strict';

/** Bind final stats to an allocation slot, never to a reusable catalog-player archetype. */
export function finalPerformance(plan, champions) {
  assert.equal(champions.length, 10, 'A complete ten-player final stat line is required');
  const seen = new Set();
  return champions.map(unit => {
    assert.ok(['blue', 'red'].includes(unit.team), 'Invalid final player side');
    const matches = plan[unit.team].filter(slot => slot.avatar_id === unit.champion.id);
    assert.equal(matches.length, 1, 'Final Avatar must identify exactly one allocated slot on its side');
    const slot = matches[0];
    assert.equal(slot.card_id, unit.player.id, 'Final archetype differs from its allocated slot');
    assert.ok(slot.instance_id && !seen.has(slot.instance_id), 'Final player instance must be unique');
    seen.add(slot.instance_id);
    return {instance_id:slot.instance_id,team:unit.team,kills:unit.kills,deaths:unit.deaths,
      assists:unit.assists,cs:unit.cs,gold:unit.gold,damage:unit.damageDealt};
  });
}
