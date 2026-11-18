import {FPS_GAMEPLANS} from '../../fps/fpsIdentity';
import type {FixturePlan} from './FixtureBoard';

const DIMENSIONS = [
  {key: 'tempo', label: 'Tempo', low: 'Measured', high: 'Fast'},
  {key: 'structure', label: 'Structure', low: 'Flexible', high: 'Assigned'},
  {key: 'aggression', label: 'Contact risk', low: 'Conservative', high: 'Assertive'},
  {key: 'preparation', label: 'Preparation', low: 'Improvised', high: 'Prepared'},
  {key: 'freedom', label: 'Individual freedom', low: 'Directed', high: 'Autonomous'},
  {key: 'economy', label: 'Economy', low: 'Spend now', high: 'Preserve resources'},
] as const;
const INSTRUCTIONS = {balanced: 'Balanced', hold: 'Hold', initiative: 'Take initiative', support: 'Support'} as const;

/**
 * An optional plan for one fixture: a different gameplan and individual instructions. Positions stay
 * club-wide (one unique T and CT position each). A plan the players don't know yet starts with less
 * familiarity; your head coach's match preparation carries part of the club plan over.
 */
export function FixturePlanEditor({plan, onChange, starters, map}: {
  plan: FixturePlan | null; onChange: (plan: FixturePlan | null) => void;
  starters: {id: string; name: string}[]; map?: {name: string} | null;
}) {
  const gameplan = plan?.gameplan;
  const setGameplan = (next: Record<string, number> | undefined) => {
    const out: FixturePlan = {...(plan ?? {}), gameplan: next};
    if (!next) delete out.gameplan;
    onChange(out.gameplan || (out.instructions && Object.keys(out.instructions).length) ? out : null);
  };
  const setInstruction = (id: string, value: string) => {
    const instructions = {...(plan?.instructions ?? {})};
    if (value) instructions[id] = value; else delete instructions[id];
    const out: FixturePlan = {...(plan ?? {}), instructions};
    if (!Object.keys(instructions).length) delete out.instructions;
    onChange(out.gameplan || out.instructions ? out : null);
  };
  return <details className="fixture-plan" open={!!plan}>
    <summary>Plan for this game <small>{plan ? 'Custom plan' : 'Club gameplan and instructions'}{map ? ` · ${map.name}` : ''}</small></summary>
    <p className="club-help">Optional. Players know your club gameplan best; a different plan starts with less familiarity, and your head coach's match preparation carries part of it over.</p>
    <label className="fixture-plan__preset">Gameplan
      <select value={gameplan ? 'custom' : ''} onChange={e => {
        const v = e.target.value;
        if (!v) setGameplan(undefined);
        else if (FPS_GAMEPLANS[v]) setGameplan({...FPS_GAMEPLANS[v].plan} as unknown as Record<string, number>);
      }}>
        <option value="">Use the club gameplan</option>
        {gameplan && <option value="custom">Custom for this game</option>}
        {Object.entries(FPS_GAMEPLANS).map(([key, preset]) => <option key={key} value={key}>{preset.name}</option>)}
      </select>
    </label>
    {gameplan && <div className="fixture-plan__sliders">{DIMENSIONS.map(d => <label key={d.key}>{d.label}: {d.low} / {d.high}
      <input type="range" min="0" max="1" step="0.05" value={gameplan[d.key] ?? .5} onChange={e => setGameplan({...gameplan, [d.key]: Number(e.target.value)})} /></label>)}</div>}
    <div className="fixture-plan__instructions">{starters.map(p => <label key={p.id}>{p.name}
      <select value={plan?.instructions?.[p.id] ?? ''} onChange={e => setInstruction(p.id, e.target.value)}>
        <option value="">Club instruction</option>
        {Object.entries(INSTRUCTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>)}</div>
  </details>;
}
