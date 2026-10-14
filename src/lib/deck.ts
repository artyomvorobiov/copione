import { mediaKey } from './media';
import { hashString, seededRandom, shuffle } from './random';
import type { DeckItem, MatchState, MediaSummary } from './types';

export const DECK_SIZE = 30;

export function toDeckItem(m: MediaSummary): DeckItem {
  return {
    type: m.type,
    id: String(m.id),
    title: m.title,
    subtitle: m.subtitle ?? null,
    poster: m.poster ?? null,
    year: m.year ?? null,
    genres: (m.genres ?? []).slice(0, 6),
    runtime: m.runtime ?? null,
    creator: m.creator ?? null,
    overview: m.overview ? m.overview.slice(0, 400) : null,
    score: m.score ?? null,
  };
}

/**
 * Builds a deck for a Match room: mixes candidate sources, drops duplicates and
 * titles the host has already seen, shuffles deterministically by seed.
 */
export function buildDeck(
  sources: MediaSummary[][],
  options: { exclude?: Set<string>; seed: string; size?: number },
): DeckItem[] {
  const size = options.size ?? DECK_SIZE;
  const exclude = options.exclude ?? new Set<string>();
  const seen = new Set<string>();
  const pool: MediaSummary[] = [];
  for (const source of sources) {
    for (const item of source) {
      const key = mediaKey(item);
      if (seen.has(key) || exclude.has(key) || !item.title) continue;
      seen.add(key);
      pool.push(item);
    }
  }
  const random = seededRandom(hashString(options.seed));
  return shuffle(pool, random).slice(0, size).map(toDeckItem);
}

/** Deck items liked by every member (needs at least two members). */
export function findMatches(state: MatchState): DeckItem[] {
  const memberIds = state.members.map((m) => m.id);
  if (memberIds.length < 2) return [];
  const likes = new Map<string, Set<string>>();
  for (const s of state.swipes) {
    if (!s.liked) continue;
    if (!likes.has(s.key)) likes.set(s.key, new Set());
    likes.get(s.key)!.add(s.userId);
  }
  return state.room.deck.filter((item) => {
    const who = likes.get(mediaKey(item));
    return !!who && memberIds.every((id) => who.has(id));
  });
}

/** Index of the first deck card the user has not swiped yet (deck length when done). */
export function nextCardIndex(state: MatchState, userId: string): number {
  const mine = new Set(state.swipes.filter((s) => s.userId === userId).map((s) => s.key));
  const idx = state.room.deck.findIndex((item) => !mine.has(mediaKey(item)));
  return idx < 0 ? state.room.deck.length : idx;
}
