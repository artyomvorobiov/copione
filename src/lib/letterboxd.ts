import { csvObjects } from './csv';
import { isValidISODate } from './dates';
import { normalizeRating } from './rating';

/** Files from Letterboxd's "Export your data" archive that we understand. */
export type LetterboxdKind = 'diary' | 'reviews' | 'ratings' | 'watched' | 'watchlist' | 'likes';

export interface LetterboxdRow {
  name: string;
  year: number | null;
  rating: number | null;
  /** YYYY-MM-DD when the film was watched (diary/reviews) or logged. */
  watchedOn: string | null;
  rewatch: boolean;
  review: string | null;
}

export interface LetterboxdFile {
  kind: LetterboxdKind;
  rows: LetterboxdRow[];
}

function lowerHeaders(headers: string[]): Set<string> {
  return new Set(headers.map((h) => h.toLowerCase()));
}

export function detectLetterboxdKind(headers: string[], fileName: string): LetterboxdKind | null {
  const h = lowerHeaders(headers);
  if (!h.has('name')) return null;
  if (h.has('review')) return 'reviews';
  if (h.has('watched date')) return 'diary';
  if (h.has('rating')) return 'ratings';
  const name = fileName.toLowerCase();
  if (name.includes('watchlist')) return 'watchlist';
  if (name.includes('like')) return 'likes';
  if (name.includes('watched')) return 'watched';
  return null;
}

function field(record: Record<string, string>, name: string): string {
  const key = Object.keys(record).find((k) => k.toLowerCase() === name);
  return key ? record[key] : '';
}

export function parseLetterboxdCsv(text: string, fileName: string): LetterboxdFile | null {
  const { headers, records } = csvObjects(text);
  const kind = detectLetterboxdKind(headers, fileName);
  if (!kind) return null;

  const rows: LetterboxdRow[] = [];
  for (const rec of records) {
    const name = field(rec, 'name');
    if (!name) continue;
    const yearNum = Number(field(rec, 'year'));
    const ratingRaw = field(rec, 'rating');
    const watched = field(rec, 'watched date') || field(rec, 'date');
    rows.push({
      name,
      year: Number.isInteger(yearNum) && yearNum > 1800 ? yearNum : null,
      rating: ratingRaw ? normalizeRating(Number(ratingRaw)) : null,
      watchedOn: watched && isValidISODate(watched) ? watched : null,
      rewatch: field(rec, 'rewatch').toLowerCase() === 'yes',
      review: field(rec, 'review') || null,
    });
  }
  return { kind, rows };
}
