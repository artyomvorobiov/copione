import type { Domain } from './types';

/**
 * Vibes are quick tags people attach to a diary entry ("mind-blowing",
 * "on repeat"…). The title page shows what share of the audience felt each one.
 * Ids are stored in the database — never rename them; labels live in i18n.
 */
export interface Vibe {
  id: string;
  emoji: string;
  domain: Domain;
}

export const VIBES: readonly Vibe[] = [
  { id: 'mindblowing', emoji: '🤯', domain: 'film' },
  { id: 'gripping', emoji: '⚡', domain: 'film' },
  { id: 'tearjerker', emoji: '😭', domain: 'film' },
  { id: 'funny', emoji: '😂', domain: 'film' },
  { id: 'scary', emoji: '😱', domain: 'film' },
  { id: 'cozy', emoji: '🫶', domain: 'film' },
  { id: 'thoughtful', emoji: '🧠', domain: 'film' },
  { id: 'twist', emoji: '🌀', domain: 'film' },
  { id: 'visual', emoji: '🎨', domain: 'film' },
  { id: 'score', emoji: '🎻', domain: 'film' },
  { id: 'rewatchable', emoji: '🔁', domain: 'film' },
  { id: 'family', emoji: '👨‍👩‍👧', domain: 'film' },
  { id: 'slow', emoji: '🐢', domain: 'film' },
  { id: 'overrated', emoji: '💔', domain: 'film' },

  { id: 'banger', emoji: '🔥', domain: 'music' },
  { id: 'onrepeat', emoji: '🔂', domain: 'music' },
  { id: 'dance', emoji: '💃', domain: 'music' },
  { id: 'chill', emoji: '😌', domain: 'music' },
  { id: 'sad', emoji: '🌧️', domain: 'music' },
  { id: 'night', emoji: '🌙', domain: 'music' },
  { id: 'atmospheric', emoji: '🌫️', domain: 'music' },
  { id: 'lyrics', emoji: '✍️', domain: 'music' },
  { id: 'production', emoji: '🎛️', domain: 'music' },
  { id: 'nostalgic', emoji: '📼', domain: 'music' },
  { id: 'roadtrip', emoji: '🚗', domain: 'music' },
  { id: 'workout', emoji: '🏃', domain: 'music' },
  { id: 'romantic', emoji: '💘', domain: 'music' },
  { id: 'skippable', emoji: '⏭️', domain: 'music' },
];

export const MAX_VIBES = 3;

const BY_ID = new Map(VIBES.map((v) => [v.id, v]));

export function vibeById(id: string): Vibe | undefined {
  return BY_ID.get(id);
}

export function vibesFor(domain: Domain): Vibe[] {
  return VIBES.filter((v) => v.domain === domain);
}

/** Keeps known vibes of the right domain, without duplicates, up to the limit. */
export function sanitizeVibes(ids: string[], domain: Domain): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const v = BY_ID.get(id);
    if (!v || v.domain !== domain || out.includes(id)) continue;
    out.push(id);
    if (out.length === MAX_VIBES) break;
  }
  return out;
}

/** Share of entries (with any vibe) that picked the given vibe, 0..100. */
export function vibePercent(count: number, vibeEntries: number): number {
  if (vibeEntries <= 0) return 0;
  return Math.round((count / vibeEntries) * 100);
}
