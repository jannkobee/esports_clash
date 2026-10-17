export type ParityStatus = 'shared' | 'live-only' | 'headless-simplified';
export interface ParityInventoryEntry { area: string; status: ParityStatus; liveOwner: string; headlessOwner: string; limit: string; }

/** Source-backed scope inventory. It is documentation data, never a simulator switch. */
export const LIVE_HEADLESS_PARITY: readonly ParityInventoryEntry[] = Object.freeze([
  { area: 'Core combat, structures, objectives, turret attribution', status: 'shared', liveOwner: 'AramMatchView.tsx', headlessOwner: 'matchSimulationEngine.ts', limit: 'Both use authored rule modules but remain separate executors.' },
  { area: 'Residual macro selector, team intent, spatial/outlook/memory/conversion scores', status: 'live-only', liveOwner: 'AramMatchView.tsx', headlessOwner: 'none', limit: 'Headless results cannot measure these live decision layers.' },
  { area: 'Ability choreography, projectile timing, terrain presentation and spectator state', status: 'live-only', liveOwner: 'AramMatchView.tsx', headlessOwner: 'none', limit: 'Headless has no browser/render execution.' },
  { area: 'Champion choices, jungle/objective and tower-risk reads', status: 'headless-simplified', liveOwner: 'AramMatchView.tsx', headlessOwner: 'matchSimulationEngine.ts', limit: 'Same authored inputs do not establish identical sequencing or outcomes.' },
]);

export const HEADLESS_PARITY_DISCLAIMER = 'Headless simulations measure their own deterministic simplified executor; they are not evidence of live AI parity.';
