import { activeYears, computeStats, DEFAULT_EPISODE_MINUTES } from '../stats';
import type { Entry, MediaSnapshot, SeenEpisode } from '../types';

let n = 0;
function entry(media: Partial<MediaSnapshot> & Pick<MediaSnapshot, 'type'>, watchedOn: string, extra: Partial<Entry> = {}): Entry {
  n += 1;
  return {
    id: `e${n}`,
    userId: 'u',
    media: { id: String(n), title: `t${n}`, genres: [], ...media },
    season: null,
    watchedOn,
    rating: null,
    liked: false,
    rewatch: false,
    review: null,
    spoilers: false,
    vibes: [],
    createdAt: `${watchedOn}T12:00:00Z`,
    ...extra,
  };
}

describe('computeStats', () => {
  const entries: Entry[] = [
    entry({ type: 'movie', runtime: 120, genres: ['18'], creator: 'Nolan' }, '2026-01-10', { rating: 4, review: 'Great' }),
    entry({ type: 'movie', runtime: 100, genres: ['18', '35'], creator: 'Nolan' }, '2026-02-01', { rating: 5, liked: true }),
    entry({ type: 'movie', runtime: 90, genres: ['35'] }, '2025-12-31', { rating: 1 }),
    entry({ type: 'album', runtime: 45, genres: ['Rock'], creator: 'Pink Floyd' }, '2026-03-03', { rating: 4.5 }),
    entry({ type: 'track', runtime: 4, genres: ['Pop'], creator: 'The Weeknd' }, '2026-03-04'),
    entry({ type: 'tv', runtime: 50, genres: ['18'] }, '2026-03-05', { rating: 3 }),
  ];
  const episodes: SeenEpisode[] = [
    { showId: 's1', season: 1, episode: 1, runtime: 50, seenAt: '2026-03-01T20:00:00' },
    { showId: 's1', season: 1, episode: 2, runtime: null, seenAt: '2026-03-02T20:00:00' },
    { showId: 's2', season: 1, episode: 1, runtime: 30, seenAt: '2025-06-01T20:00:00' },
  ];

  it('limits the numbers to the chosen year', () => {
    const stats = computeStats(entries, episodes, 2026);
    expect(stats.film.movies).toBe(2);
    expect(stats.film.showEntries).toBe(1);
    expect(stats.film.episodes).toBe(2);
    expect(stats.film.minutes).toBe(120 + 100 + 50 + DEFAULT_EPISODE_MINUTES);
    expect(stats.film.avgRating).toBe(4);
    expect(stats.film.topGenres[0]).toEqual({ name: '18', count: 3 });
    expect(stats.film.topCreators[0]).toEqual({ name: 'Nolan', count: 2 });
    expect(stats.film.byMonth[0]).toBe(1);
    expect(stats.film.byMonth[2]).toBe(1);
    expect(stats.music.albums).toBe(1);
    expect(stats.music.tracks).toBe(1);
    expect(stats.music.minutes).toBe(49);
  });

  it('covers all time when the year is null', () => {
    const stats = computeStats(entries, episodes, null);
    expect(stats.film.movies).toBe(3);
    expect(stats.film.episodes).toBe(3);
    expect(stats.film.histogram[1]).toBe(1);
    expect(stats.film.histogram[9]).toBe(1);
  });

  it('lists active years', () => {
    expect(activeYears(entries, 2026)).toEqual([2026, 2025]);
  });
});
