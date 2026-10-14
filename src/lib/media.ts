import type { Domain, MediaRef, MediaSnapshot, MediaSummary, MediaType } from './types';
import { domainOf } from './types';

export function mediaKey(ref: MediaRef): string {
  return `${ref.type}:${ref.id}`;
}

export function parseMediaKey(key: string): MediaRef | null {
  const idx = key.indexOf(':');
  if (idx < 0) return null;
  const type = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if (!isMediaType(type) || !id) return null;
  return { type, id };
}

export function isMediaType(value: unknown): value is MediaType {
  return value === 'movie' || value === 'tv' || value === 'album' || value === 'track';
}

export function sameMedia(a: MediaRef, b: MediaRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export function inDomain(type: MediaType, domain: Domain | null | undefined): boolean {
  return !domain || domainOf(type) === domain;
}

/** Strips catalog-only fields so the object can be stored with user data. */
export function toSnapshot(m: MediaSnapshot | MediaSummary): MediaSnapshot {
  return {
    type: m.type,
    id: String(m.id),
    title: m.title,
    subtitle: m.subtitle ?? null,
    poster: m.poster ?? null,
    year: m.year ?? null,
    genres: (m.genres ?? []).slice(0, 12),
    runtime: m.runtime != null ? Math.round(m.runtime) : null,
    creator: m.creator ?? null,
  };
}

export function isSeries(ref: MediaRef): boolean {
  return ref.type === 'tv';
}

export function isMusic(ref: MediaRef): boolean {
  return ref.type === 'album' || ref.type === 'track';
}

/** Albums/tracks use square artwork, films use 2:3 posters. */
export function posterAspect(type: MediaType): number {
  return type === 'album' || type === 'track' ? 1 : 2 / 3;
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
