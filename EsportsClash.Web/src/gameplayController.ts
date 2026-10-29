/** Frozen per match. Full command learning remains an explicit research mode. */
export type GameplayController = 'baseline' | 'hybrid' | 'arena' | 'legacy';
export function gameplayController(fixture: boolean, requested?: GameplayController): GameplayController {
  return fixture ? requested ?? 'legacy' : requested === 'baseline' ? 'baseline' : 'hybrid';
}
export const usesBaseline = (mode: GameplayController) => mode !== 'arena';
export const usesLearning = (mode: GameplayController) => mode === 'hybrid' || mode === 'legacy';
