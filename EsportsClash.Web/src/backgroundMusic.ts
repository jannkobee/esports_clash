export interface BackgroundMusicStep {
  chordNotes: readonly number[];
  arpeggioNote: number;
  bassNote: number | null;
  startsBar: boolean;
}

const CHORDS: readonly (readonly number[])[] = [
  [50, 57, 62, 65],
  [46, 53, 58, 62],
  [41, 48, 53, 57],
  [48, 55, 60, 64],
];
const ARPEGGIO_PATTERN = [0, 1, 2, 1, 3, 2, 1, 2] as const;

export const BACKGROUND_MUSIC_BPM = 84;
export const BACKGROUND_MUSIC_STEPS_PER_BAR = 8;
export const BACKGROUND_MUSIC_LOOP_STEPS = 16 * BACKGROUND_MUSIC_STEPS_PER_BAR;

export function getBackgroundMusicStep(stepIndex: number): BackgroundMusicStep {
  const position = ((Math.floor(stepIndex) % BACKGROUND_MUSIC_LOOP_STEPS) + BACKGROUND_MUSIC_LOOP_STEPS)
    % BACKGROUND_MUSIC_LOOP_STEPS;
  const stepInBar = position % BACKGROUND_MUSIC_STEPS_PER_BAR;
  const barIndex = Math.floor(position / BACKGROUND_MUSIC_STEPS_PER_BAR);
  const chordNotes = CHORDS[Math.floor(barIndex / 4)];
  const arpeggioNote = chordNotes[ARPEGGIO_PATTERN[stepInBar]] + 12;
  const bassNote = stepInBar === 0 || stepInBar === 4 ? chordNotes[0] - 12 : null;
  return {
    chordNotes,
    arpeggioNote,
    bassNote,
    startsBar: stepInBar === 0,
  };
}
