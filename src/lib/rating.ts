/** Ratings are half-stars from 0.5 to 5. */

export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export function normalizeRating(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 2) / 2;
  if (rounded < 0.5) return null;
  return Math.min(5, rounded);
}

export function formatRating(value: number | null | undefined): string {
  if (value == null) return '';
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(1);
}

/** "★★★★½" — handy for share texts and CSV exports. */
export function starsText(value: number | null | undefined): string {
  const r = normalizeRating(value);
  if (r == null) return '';
  const full = Math.floor(r);
  return '★'.repeat(full) + (r - full >= 0.5 ? '½' : '');
}

/** Average of an album's track ratings, rounded to a half star. */
export function suggestedAlbumRating(trackRatings: (number | null | undefined)[]): number | null {
  const values = trackRatings.filter((r): r is number => r != null);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return normalizeRating(avg);
}

/** Histogram index (0..9) for a half-star rating. */
export function ratingBucket(value: number): number {
  return Math.min(9, Math.max(0, Math.round(value * 2) - 1));
}
