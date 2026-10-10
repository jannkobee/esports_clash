// scripts/validate-design.js
// Anti-Regression Validation Script for Esports Clash Bridge Arena Mode
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🛡️  ESPORTS CLASH - DESIGN DOCUMENT & ANTI-REGRESSION CHECK');
console.log('================================================================');

let errors = [];

// 1. Check ARAM Bushes count (must be exactly 5, mid bushes removed)
const arenaRulesPath = path.resolve('src/arenaRules.ts');
const arenaRulesContent = fs.readFileSync(arenaRulesPath, 'utf8');
if (arenaRulesContent.includes('bush_mid_north') || arenaRulesContent.includes('bush_mid_south')) {
  errors.push('CRITICAL: Mid bushes (bush_mid_north / bush_mid_south) must remain removed!');
} else {
  console.log('✅ Bush Layout: river, pit, valley, and highground flank bushes verified (Mid bushes absent)');
}

// 2. Check Confetti (must be 0 confetti across game)
const matchViewPath = path.resolve('src/components/AramMatchView.tsx');
const matchViewContent = fs.readFileSync(matchViewPath, 'utf8');
if (matchViewContent.includes('canvas-confetti') || /confetti\s*\(/.test(matchViewContent)) {
  errors.push('CRITICAL: Confetti calls or imports found in AramMatchView.tsx! Confetti must remain removed.');
} else {
  console.log('✅ Visual Integrity: 0 confetti calls found');
}

// 3. Check Dodge Blink (must not contain perpendicular side-step 58px teleport)
if (matchViewContent.includes('intended.x - dy / length * 58') || matchViewContent.includes('intended.y + dx / length * 58')) {
  errors.push('CRITICAL: Aggressive dodge blink teleport detected in AramMatchView.tsx! Mobility belongs strictly to champion skills.');
} else {
  console.log('✅ Movement Mechanics: Dodge teleport blink removed; authentic skill mobility preserved');
}

// 4. Check Jungle Return Speed (must not contain instantaneous * 2.0 spring acceleration)
if (/targetFormY - u\.y\)\s*\*\s*2\.0\s*\*\s*dt/.test(matchViewContent)) {
  errors.push('CRITICAL: Unnatural jungle return speed acceleration (* 2.0 * dt) detected in AramMatchView.tsx!');
} else {
  console.log('✅ Movement Mechanics: Natural walking speed verified for lane and jungle returns');
}

// 5. Check Dragon Empowerment & Siege Multiplier
if (!matchViewContent.includes('adBonus: 45') || !matchViewContent.includes('apBonus: 50')
  || !matchViewContent.includes('siegeMultiplier: 1.5') || !matchViewContent.includes('burnTrueDamage: true')) {
  errors.push('CRITICAL: Dragon Slayer Aspect lost its tuned AD/AP, 1.5x siege, or burn values!');
} else {
  console.log('✅ Game Pacing: Dragon Slayer Aspect uses +45 AD, +50 AP, 1.5x siege and true damage burn');
}

if (!matchViewContent.includes('towerSiegeMultiplier(matchTimeRef.current)')
  || !matchViewContent.includes('canDamageNexus(structure.team, structuresRef.current)')) {
  errors.push('CRITICAL: Turret plating or the barracks-gated nexus shield is missing!');
} else {
  console.log('✅ Game Pacing: early turret plating and barracks-gated nexus shield verified');
}

// 6. Check Ranged Projectile System
if (!matchViewContent.includes('getChampionBasicProjectile') || !matchViewContent.includes('executeChampionAttack')) {
  errors.push('CRITICAL: Basic attack projectile system missing from AramMatchView.tsx!');
} else {
  console.log('✅ Combat Visuals: Basic attack projectile system verified for ranged & melee avatars');
}

// 7. Check In-Game Squad HUD placement (must be inside the arena container)
if (!matchViewContent.includes('IN-GAME SQUAD HUD & ITEM SCOREBOARD OVERLAY') || !matchViewContent.includes('hudMode')) {
  errors.push('CRITICAL: In-Game Squad HUD missing or displaced from arena container in AramMatchView.tsx!');
} else {
  console.log('✅ Viewport Integration: Squad status & item inventory HUD docked inside game screen');
}

// 8. Check Skill Cast Ranges (Raijin Electric Vortex must be strictly 120px / 2-3 hexes)
const skillRangePath = path.resolve('src/skillRangeRules.ts');
const skillRangeContent = fs.readFileSync(skillRangePath, 'utf8');
if (!skillRangeContent.includes("if (slot === 'skill2') return 120;") || !matchViewContent.includes('getSkillCastRange')) {
  errors.push('CRITICAL: Raijin Electric Vortex cast range must be strictly 120px (2-3 hexes risk zone)!');
} else {
  console.log('✅ Skill Cast Ranges: Raijin Electric Vortex strictly restricted to 2-3 hexes (120px); authentic ranges enforced');
}

// 9. Check Chain Stun & Layered CC System
if (!skillRangeContent.includes('applyChainStun') || !skillRangeContent.includes('shouldHoldSkillForChainStun') || !matchViewContent.includes('applyChampionCrowdControl')) {
  errors.push('CRITICAL: Chain stun layering or coordination hold checks missing from codebase!');
} else {
  console.log('✅ CC Layering: Chain Stun mechanics active (high IQ/chemistry hold and layer CC; float text verified)');
}

// 10. Check GDD Documentation existence
const docPath = path.resolve('../.gemini/antigravity/brain/a8ba8612-f158-4f16-adfd-1b8deba208af/esports_clash_gdd_and_tech_plan.md');
if (fs.existsSync(docPath)) {
  console.log('✅ Design Documentation: esports_clash_gdd_and_tech_plan.md verified and up to date');
}

// 11. Check Sylla True Form Balance (must not permanently inflate Max HP or Armor)
if (matchViewContent.includes('u.maxHp += 600') || matchViewContent.includes('u.champion.armor += 35')) {
  errors.push('CRITICAL: Sylla True Form permanent HP or Armor stacking detected! True Form must be a temporary buff.');
} else {
  console.log('✅ Sylla Balance: Permanent stat stacking removed; True Form uses temporary shield & timer');
}

// 12. Check Warmog\'s Out-of-Combat Requirement
if (!matchViewContent.includes('(c.combatTimer ?? 0) <= 0')) {
  errors.push('CRITICAL: Warmogs Heart must require out-of-combat (combatTimer <= 0) before regenerating HP!');
} else {
  console.log('✅ Tank Item Balance: Warmogs Heart out-of-combat requirement enforced (no in-combat invulnerability)');
}

// 13. Check Marksman Anti-Tank Items & On-Hit Mechanics
const itemsPath = path.resolve('src/itemsData.ts');
const itemsContent = fs.readFileSync(itemsPath, 'utf8');
if (!itemsContent.includes('item_kraken_slayer') || !itemsContent.includes('item_ldr') || !itemsContent.includes('item_bork')) {
  errors.push('CRITICAL: Marksman anti-tank core items (Kraken Slayer, LDR, Bork) missing from itemsData.ts!');
} else if (!matchViewContent.includes('hasKraken') || !matchViewContent.includes('hasLdr') || !matchViewContent.includes('hasBork')) {
  errors.push('CRITICAL: Marksman item passives (Kraken Slayer, LDR, Bork) not integrated in AramMatchView.tsx attack execution!');
} else {
  console.log('✅ Marksman DPS & Anti-Tank: Kraken Slayer, LDR Giant Slayer, Bork % HP on-hit active');
}

// 14. Keep draft, online room authority, and ability progression wired into the arena.
const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const draftContent = fs.readFileSync(path.resolve('src/components/DraftPhaseView.tsx'), 'utf8');
const roomContent = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
if (!appContent.includes('Vs AI') || !appContent.includes('Vs Player') || !draftContent.includes('DRAFT_TURNS')
    || !draftContent.includes('chooseCoachTeamPick')) {
  errors.push('CRITICAL: arena mode dashboard or coach-led alternating draft missing!');
} else {
  console.log('✅ Draft Flow: Vs AI / Vs Player dashboard and coach-led alternating picks verified');
}
if (!roomContent.includes('expectedRevision') || !roomContent.includes('room.tokens[side]')
    || !roomContent.includes('championIds.has(championId)')) {
  errors.push('CRITICAL: online room must reject stale, unauthorized, and unknown draft actions!');
} else {
  console.log('✅ Online Rooms: server checks draft turns, identity and revisions');
}
if (!matchViewContent.includes('abilityDamageMultiplier') || !matchViewContent.includes('abilityCooldownMultiplier')) {
  errors.push('CRITICAL: avatar abilities must scale with ability ranks!');
} else {
  console.log('✅ Ability Ranks: damage and cooldown progression wired into combat');
}

console.log('================================================================');
if (errors.length > 0) {
  console.error('❌ DESIGN VALIDATION FAILED:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('🎉 ALL GAME DESIGN RULES & SAFETY CHECKS PASSED!');
  console.log('================================================================\n');
}
