export const DEFAULT_FORM_RATING = 6;

export const MATCH_RATING_WORDS = [
  'Dreadful',
  'Poor',
  'Weak',
  'Mediocre',
  'Average',
  'Passable',
  'Good',
  'Strong',
  'Excellent',
  'Exceptional',
] as const;

export function ratingWord(value: number): string {
  if (!Number.isFinite(value)) return 'Unrated';
  const score = Math.max(1, Math.min(10, Math.round(value)));
  return MATCH_RATING_WORDS[score - 1];
}

export function recentFormRating(ratings: number[]): number {
  if (!ratings.length) return DEFAULT_FORM_RATING;
  const average = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  return Math.round(Math.max(1, Math.min(10, average)) * 10) / 10;
}
