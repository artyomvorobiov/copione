import { localDayOf, monthOf } from './dates';
import { mediaKey } from './media';
import { ratingBucket } from './rating';
import type { Entry, SeenEpisode } from './types';

export interface CountItem {
  name: string;
  count: number;
}

interface DomainStats {
  /** Diary entries in the period (rewatches included). */
  entries: number;
  /** Distinct titles in the period. */
  titles: number;
  minutes: number;
  avgRating: number | null;
  /** Ratings per half-star bucket (index 0 = 0.5★). */
  histogram: number[];
  /** Diary entries per month (index 0 = January). */
  byMonth: number[];
  /** Genre keys: TMDB genre ids for films, genre names for music. */
  topGenres: CountItem[];
  /** Directors/showrunners for films, artists for music. */
  topCreators: CountItem[];
  reviews: number;
  liked: number;
  rewatches: number;
}

export interface FilmStats extends DomainStats {
  movies: number;
  showEntries: number;
  episodes: number;
  shows: number;
}

export interface MusicStats extends DomainStats {
  albums: number;
  tracks: number;
}

export interface PeriodStats {
  year: number | null;
  film: FilmStats;
  music: MusicStats;
}

export const DEFAULT_EPISODE_MINUTES = 45;

function top(counter: Map<string, number>, limit: number): CountItem[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function bump(counter: Map<string, number>, key: string | null | undefined, by = 1) {
  if (!key) return;
  counter.set(key, (counter.get(key) ?? 0) + by);
}

function domainStats(entries: Entry[]): DomainStats {
  const histogram = new Array<number>(10).fill(0);
  const byMonth = new Array<number>(12).fill(0);
  const genres = new Map<string, number>();
  const creators = new Map<string, number>();
  const titles = new Set<string>();
  let ratingSum = 0;
  let ratingCount = 0;
  let minutes = 0;
  let reviews = 0;
  let liked = 0;
  let rewatches = 0;

  for (const e of entries) {
    titles.add(mediaKey(e.media));
    byMonth[monthOf(e.watchedOn)] += 1;
    if (e.rating != null) {
      histogram[ratingBucket(e.rating)] += 1;
      ratingSum += e.rating;
      ratingCount += 1;
    }
    if (e.media.type !== 'tv') minutes += e.media.runtime ?? 0;
    if (e.review) reviews += 1;
    if (e.liked) liked += 1;
    if (e.rewatch) rewatches += 1;
    for (const g of e.media.genres ?? []) bump(genres, g);
    bump(creators, e.media.creator);
  }

  return {
    entries: entries.length,
    titles: titles.size,
    minutes,
    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : null,
    histogram,
    byMonth,
    topGenres: top(genres, 5),
    topCreators: top(creators, 5),
    reviews,
    liked,
    rewatches,
  };
}

/** Year-in-review numbers for one year, or for all time when `year` is null. */
export function computeStats(entries: Entry[], episodes: SeenEpisode[], year: number | null): PeriodStats {
  const prefix = year == null ? null : `${year}-`;
  const inPeriod = entries.filter((e) => !prefix || e.watchedOn.startsWith(prefix));
  const filmEntries = inPeriod.filter((e) => e.media.type === 'movie' || e.media.type === 'tv');
  const musicEntries = inPeriod.filter((e) => e.media.type === 'album' || e.media.type === 'track');
  const eps = episodes.filter((e) => !prefix || localDayOf(e.seenAt).startsWith(prefix));

  const film = domainStats(filmEntries);
  const episodeMinutes = eps.reduce((sum, e) => sum + (e.runtime ?? DEFAULT_EPISODE_MINUTES), 0);
  const shows = new Set<string>([
    ...eps.map((e) => e.showId),
    ...filmEntries.filter((e) => e.media.type === 'tv').map((e) => e.media.id),
  ]);

  const music = domainStats(musicEntries);

  return {
    year,
    film: {
      ...film,
      minutes: film.minutes + episodeMinutes,
      movies: filmEntries.filter((e) => e.media.type === 'movie').length,
      showEntries: filmEntries.filter((e) => e.media.type === 'tv').length,
      episodes: eps.length,
      shows: shows.size,
    },
    music: {
      ...music,
      albums: musicEntries.filter((e) => e.media.type === 'album').length,
      tracks: musicEntries.filter((e) => e.media.type === 'track').length,
    },
  };
}

/** Years that have any diary activity, newest first. */
export function activeYears(entries: Entry[], current: number): number[] {
  const years = new Set<number>([current]);
  for (const e of entries) {
    const y = Number(e.watchedOn.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
