import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities.ts';
import { kaelenCastPosition, type KaelenCast } from './kaelenSpellRuntime.ts';

export function drawKaelenSpell(ctx: CanvasRenderingContext2D, cast: KaelenCast, alpha: number) {
  const spell = KAELEN_INVOKED_SPELLS.find(spell => spell.id === cast.spellId);
  if (!spell) return;
  const position = kaelenCastPosition(cast, spell);
  const winding = cast.elapsed < spell.delay;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 2));
  ctx.strokeStyle = spell.color;
  ctx.fillStyle = spell.color;
  ctx.shadowColor = spell.color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  if (spell.shape === 'snowball') {
    ctx.globalAlpha *= 0.25;
    ctx.beginPath(); ctx.moveTo(cast.origin.x, cast.origin.y); ctx.lineTo(position.x, position.y); ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha * 2);
    ctx.translate(position.x, position.y);
    ctx.rotate(cast.elapsed * 5);
    const radius = position.radius * 0.75;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3;
    for (let arm = 0; arm < 6; arm++) {
      ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radius * 0.8, 0);
      ctx.moveTo(radius * 0.5, 0); ctx.lineTo(radius * 0.35, -radius * 0.2); ctx.stroke();
    }
  } else if (spell.shape === 'line') {
    const angle = Math.atan2(cast.aim.y - cast.origin.y, cast.aim.x - cast.origin.x);
    ctx.translate(position.x, position.y); ctx.rotate(angle);
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-55, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.fillStyle = '#fff7ed'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-5, -12); ctx.lineTo(-5, 12); ctx.closePath(); ctx.fill();
  } else {
    ctx.setLineDash(winding ? [8, 6] : []);
    ctx.beginPath(); ctx.arc(position.x, position.y, spell.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha *= winding ? 0.12 : 0.35;
    ctx.beginPath(); ctx.arc(position.x, position.y, spell.radius * (winding ? 1 : 0.7), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.min(1, alpha * 2);
    if (spell.shape === 'meteor' && winding) {
      const height = 180 * (1 - cast.elapsed / spell.delay);
      ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(position.x - 45, position.y - height - 80); ctx.lineTo(position.x, position.y - height); ctx.stroke();
      ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(position.x, position.y - height, 22, 0, Math.PI * 2); ctx.fill();
    } else if (spell.shape === 'summon') {
      ctx.translate(position.x, position.y); ctx.rotate(cast.elapsed * .7);
      ctx.fillStyle = '#fecdd3'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(18, 8); ctx.lineTo(0, 21); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = 3; ctx.stroke();
    } else if (spell.shape === 'ally') {
      ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(position.x, position.y, spell.radius * (.75 + Math.sin(cast.elapsed * 9) * .08), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(196, 181, 253, .25)'; ctx.beginPath(); ctx.arc(position.x, position.y, spell.radius * .62, 0, Math.PI * 2); ctx.fill();
    } else if (spell.zone) {
      ctx.lineWidth = 2.5;
      for (let ring = .35; ring <= .95; ring += .3) { ctx.beginPath(); ctx.arc(position.x, position.y, spell.radius * ring, cast.elapsed * 2, cast.elapsed * 2 + Math.PI * 1.4); ctx.stroke(); }
      if (spell.id === 'sleetflare') { ctx.strokeStyle = '#fda4af'; ctx.beginPath(); ctx.moveTo(position.x - spell.radius * .6, position.y); ctx.lineTo(position.x + spell.radius * .6, position.y); ctx.stroke(); }
    } else if (!winding) {
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(position.x, position.y,
        spell.radius * Math.min(1.2, 0.3 + (cast.elapsed - spell.delay) * 3), 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha * 2); ctx.textAlign = 'center'; ctx.font = 'bold 11px system-ui';
  ctx.lineWidth = 3; ctx.strokeStyle = '#020617'; ctx.fillStyle = spell.color;
  ctx.strokeText(spell.name, position.x, position.y - position.radius - 12);
  ctx.fillText(spell.name, position.x, position.y - position.radius - 12); ctx.restore();
}
