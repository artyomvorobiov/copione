import { toCsv } from './csv';
import type { Entry } from './types';

/** Diary as CSV (one row per entry), oldest first. */
export function diaryCsv(entries: Entry[]): string {
  const header = ['Date', 'Type', 'Title', 'Year', 'Artist/Original', 'Rating', 'Liked', 'Rewatch', 'Season', 'Vibes', 'Review', 'ID'];
  const rows = [...entries]
    .sort((a, b) => a.watchedOn.localeCompare(b.watchedOn))
    .map((e) => [
      e.watchedOn,
      e.media.type,
      e.media.title,
      e.media.year ?? '',
      e.media.subtitle ?? '',
      e.rating ?? '',
      e.liked ? 'Yes' : '',
      e.rewatch ? 'Yes' : '',
      e.season ?? '',
      e.vibes.join(' '),
      e.review ?? '',
      e.media.id,
    ]);
  return toCsv([header, ...rows]);
}
