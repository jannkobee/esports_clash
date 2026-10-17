/** Pure arbitration: emergency safety overrides a previously committed fight. */
export function resolveFightCommitment(s: {
  committedState?: 'fight' | 'retreat' | 'cover'; timer: number; dangerous: boolean;
  enemyCount: number; inWell: boolean; followUp: boolean;
  lowHealth: boolean; losingFight: boolean;
  lethalEnvironment?: boolean;
}) {
  let dangerous = s.dangerous || !!s.lethalEnvironment;
  if (s.committedState === 'retreat' && s.timer > 0 && s.enemyCount > 0 && !s.inWell && !s.followUp) {
    dangerous = true;
  } else if (s.committedState === 'fight' && s.timer > 0 && !s.lowHealth && !s.losingFight && !s.lethalEnvironment) {
    dangerous = false;
  }
  let committedState = s.committedState;
  let timer = s.timer;
  if (dangerous && committedState !== 'retreat') {
    committedState = 'retreat'; timer = 0.45;
  } else if (!dangerous && committedState !== 'fight' && s.enemyCount > 0) {
    committedState = 'fight'; timer = 0.35;
  } else if (s.enemyCount === 0) committedState = undefined;
  return { dangerous, committedState, timer };
}
