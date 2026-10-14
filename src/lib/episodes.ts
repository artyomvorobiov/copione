import type { EpisodeKey } from './types';

export interface SeasonCount {
  season: number;
  episodeCount: number;
}

export function compareEpisodes(a: EpisodeKey, b: EpisodeKey): number {
  return a.season - b.season || a.episode - b.episode;
}

export function episodeKey(e: EpisodeKey): string {
  return `${e.season}:${e.episode}`;
}

/** "S2 · E5" style label without localisation. */
export function episodeCode(e: EpisodeKey): string {
  return `S${e.season} · E${e.episode}`;
}

/** Regular seasons only (TMDB lists specials as season 0), in order. */
export function regularSeasons(seasons: SeasonCount[]): SeasonCount[] {
  return seasons.filter((s) => s.season > 0 && s.episodeCount > 0).sort((a, b) => a.season - b.season);
}

/** The furthest episode seen, ignoring specials. */
export function furthestEpisode(seen: EpisodeKey[]): EpisodeKey | null {
  let best: EpisodeKey | null = null;
  for (const e of seen) {
    if (e.season <= 0) continue;
    if (!best || compareEpisodes(e, best) > 0) best = e;
  }
  return best;
}

/** The episode after `from`, or null when there are no more known episodes. */
export function episodeAfter(from: EpisodeKey | null, seasons: SeasonCount[]): EpisodeKey | null {
  const regular = regularSeasons(seasons);
  if (regular.length === 0) return null;
  if (!from) return { season: regular[0].season, episode: 1 };
  const current = regular.find((s) => s.season === from.season);
  if (current && from.episode < current.episodeCount) {
    return { season: from.season, episode: from.episode + 1 };
  }
  const next = regular.find((s) => s.season > from.season);
  return next ? { season: next.season, episode: 1 } : null;
}

/**
 * What to watch next: the episode after the furthest one seen, provided it
 * has already aired. Returns null when the viewer is caught up.
 */
export function nextEpisode(
  seen: EpisodeKey[],
  seasons: SeasonCount[],
  lastAired: EpisodeKey | null,
): EpisodeKey | null {
  const candidate = episodeAfter(furthestEpisode(seen), seasons);
  if (!candidate) return null;
  if (lastAired && compareEpisodes(candidate, lastAired) > 0) return null;
  return candidate;
}

export function totalEpisodes(seasons: SeasonCount[]): number {
  return regularSeasons(seasons).reduce((sum, s) => sum + s.episodeCount, 0);
}

/** Number of aired regular episodes (all of them when the last aired one is unknown). */
export function airedEpisodes(seasons: SeasonCount[], lastAired: EpisodeKey | null): number {
  if (!lastAired) return totalEpisodes(seasons);
  let count = 0;
  for (const s of regularSeasons(seasons)) {
    if (s.season < lastAired.season) count += s.episodeCount;
    else if (s.season === lastAired.season) count += Math.min(s.episodeCount, lastAired.episode);
  }
  return count;
}

export function seenRegularCount(seen: EpisodeKey[]): number {
  return new Set(seen.filter((e) => e.season > 0).map(episodeKey)).size;
}

/** Every regular episode from S1E1 up to and including `target`. */
export function episodesUpTo(target: EpisodeKey, seasons: SeasonCount[]): EpisodeKey[] {
  const out: EpisodeKey[] = [];
  for (const s of regularSeasons(seasons)) {
    if (s.season > target.season) break;
    const last = s.season === target.season ? Math.min(target.episode, s.episodeCount) : s.episodeCount;
    for (let e = 1; e <= last; e++) out.push({ season: s.season, episode: e });
  }
  return out;
}
