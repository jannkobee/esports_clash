import { criticState, transitionReward, type IntelligencePolicy } from './intelligencePolicy.ts';
import type { TeamTaskSnapshot } from './teamTaskOutcome.ts';
export interface ActorDecision { actor: string; team: 'blue'|'red'; second: number; observation: number[];
  action: number; mask: boolean[]; logp: number; changed: boolean; state: number[]; start: TeamTaskSnapshot;
  x: number; y: number; intent?: string; distance?: number }
export class IntelligenceTrajectory {
  pending = new Map<string,ActorDecision>();
  rows: unknown[] = [];
  counters = { eligible: 0, changed: 0, executed: 0, blocked: {} as Record<string,number> };
  last: Record<string,number> = {};
  constructor(public policies: Partial<Record<'blue'|'red',IntelligencePolicy>>, public training: boolean) {}
  settle(actor: string, end: TeamTaskSnapshot, terminal = false, winner?: boolean) {
    const previous=this.pending.get(actor); if (!previous) return;
    this.pending.delete(actor);
    if (this.training) this.rows.push({...previous, nextState:criticState(end), terminal,
      ...transitionReward(previous.start,end,terminal,winner), elapsed:end.second-previous.second});
  }
  drain() { const rows=this.rows;this.rows=[];return {rows,counters:structuredClone(this.counters)}; }
}
