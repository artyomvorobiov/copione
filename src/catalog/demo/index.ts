import { addDays, todayISO } from '@/lib/dates';
import { looksLikeSoundtrack, mentionsTitle, normalizeTitle } from '@/lib/text';
import type { MediaSummary } from '@/lib/types';

import type {
  AlbumDetails,
  ArtistDetails,
  CatalogContext,
  EpisodeInfo,
  FilmCatalog,
  FilmDetails,
  MusicCatalog,
  MusicSearchResult,
  SeasonDetails,
  TrackDetails,
  TrackItem,
} from '../types';
import { CatalogError } from '../types';

import { DEMO_FILMS, type DemoFilm } from './films';
import { DEMO_ALBUMS, DEMO_TOP_SONGS, demoTrackId, type DemoAlbum } from './music';

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeTitle(query);
  if (!q) return false;
  return fields.some((f) => !!f && normalizeTitle(f).includes(q));
}

/* ------------------------------------------------------------------------- */
/* Films                                                                     */
/* ------------------------------------------------------------------------- */

function filmSummary(f: DemoFilm, ctx: CatalogContext): MediaSummary {
  const title = f.title[ctx.lang];
  return {
    type: f.type,
    id: f.id,
    title,
    subtitle: normalizeTitle(f.original) !== normalizeTitle(title) ? f.original : null,
    poster: null,
    backdrop: null,
    year: f.year,
    genres: f.genres.map(String),
    runtime: f.runtime,
    creator: f.directors.slice(0, 2).join(', '),
    overview: f.overview[ctx.lang],
    score: f.score,
  };
}

function demoEpisodes(f: DemoFilm, season: number): EpisodeInfo[] {
  const s = f.seasons?.[season - 1];
  if (!s) return [];
  return Array.from({ length: s.episodes }, (_, i) => ({
    season,
    episode: i + 1,
    name: '',
    airDate: addDays(s.airDate, i * 7),
    runtime: f.runtime,
    overview: null,
    still: null,
  }));
}

export class DemoFilmCatalog implements FilmCatalog {
  readonly live = false;

  private find(type: string, id: string): DemoFilm {
    const f = DEMO_FILMS.find((x) => x.type === type && x.id === id);
    if (!f) throw new CatalogError('Not in the demo catalog', 404);
    return f;
  }

  async trending(type: 'movie' | 'tv', ctx: CatalogContext) {
    await delay();
    return DEMO_FILMS.filter((f) => f.type === type).map((f) => filmSummary(f, ctx));
  }

  async search(query: string, ctx: CatalogContext) {
    await delay();
    return DEMO_FILMS.filter((f) => matches(query, f.title.ru, f.title.en, f.original, ...f.directors)).map((f) =>
      filmSummary(f, ctx),
    );
  }

  async discover(type: 'movie' | 'tv', genres: number[], without: number[], ctx: CatalogContext) {
    await delay();
    return DEMO_FILMS.filter(
      (f) =>
        f.type === type &&
        (genres.length === 0 || f.genres.some((g) => genres.includes(g))) &&
        !f.genres.some((g) => without.includes(g)),
    )
      .sort((a, b) => b.score - a.score)
      .map((f) => filmSummary(f, ctx));
  }

  async details(type: 'movie' | 'tv', id: string, ctx: CatalogContext): Promise<FilmDetails> {
    await delay();
    const f = this.find(type, id);
    const base = filmSummary(f, ctx);
    const recommendations = DEMO_FILMS.filter((x) => x.type === f.type && x.id !== f.id)
      .map((x) => ({ x, shared: x.genres.filter((g) => f.genres.includes(g)).length }))
      .filter((r) => r.shared > 0)
      .sort((a, b) => b.shared - a.shared || b.x.score - a.x.score)
      .slice(0, 10)
      .map((r) => filmSummary(r.x, ctx));
    const seasons = (f.seasons ?? []).map((s, i) => ({
      season: i + 1,
      name: '',
      episodeCount: s.episodes,
      airDate: s.airDate,
      poster: null,
    }));
    const lastSeason = seasons.length;
    const lastEpisodes = lastSeason ? demoEpisodes(f, lastSeason) : [];
    const today = todayISO();
    const aired = lastEpisodes.filter((e) => (e.airDate ?? '') <= today);
    return {
      ...base,
      originalTitle: f.original,
      tagline: null,
      genreNames: [],
      directors: f.directors,
      cast: f.cast.map((name) => ({ name, character: null })),
      providers: null,
      recommendations,
      trailerKey: null,
      releaseDate: f.seasons?.[0]?.airDate ?? `${f.year}-01-01`,
      seasons,
      numberOfEpisodes: f.seasons ? f.seasons.reduce((s, x) => s + x.episodes, 0) : null,
      numberOfSeasons: f.seasons ? f.seasons.length : null,
      nextEpisode: lastEpisodes.find((e) => (e.airDate ?? '') > today) ?? null,
      lastEpisode: aired[aired.length - 1] ?? null,
      status: f.status ?? null,
      inProduction: f.status === 'Returning Series',
    };
  }

  async season(showId: string, season: number): Promise<SeasonDetails> {
    await delay();
    const f = this.find('tv', showId);
    return { season, name: '', overview: null, poster: null, episodes: demoEpisodes(f, season) };
  }

  async findMovie(title: string, year: number | null, ctx: CatalogContext) {
    const wanted = normalizeTitle(title);
    const f = DEMO_FILMS.find(
      (x) =>
        x.type === 'movie' &&
        [x.title.en, x.title.ru, x.original].some((n) => normalizeTitle(n) === wanted) &&
        (!year || Math.abs(x.year - year) <= 1),
    );
    return f ? filmSummary(f, ctx) : null;
  }
}

/* ------------------------------------------------------------------------- */
/* Music                                                                     */
/* ------------------------------------------------------------------------- */

function albumSummary(a: DemoAlbum, ctx: CatalogContext): MediaSummary {
  const durationSec = a.tracks.reduce((sum, [, sec]) => sum + sec, 0);
  return {
    type: 'album',
    id: a.id,
    title: a.title,
    subtitle: a.artist,
    poster: null,
    year: a.year,
    genres: [a.genre[ctx.lang]],
    runtime: Math.round(durationSec / 60),
    creator: a.artist,
    kind: a.kind,
    artistId: a.artistId,
  };
}

function trackItem(a: DemoAlbum, index: number, ctx: CatalogContext): TrackItem {
  const [title, sec] = a.tracks[index];
  return {
    type: 'track',
    id: demoTrackId(a.id, index + 1),
    title,
    subtitle: a.artist,
    poster: null,
    year: a.year,
    genres: [a.genre[ctx.lang]],
    runtime: Math.max(1, Math.round(sec / 60)),
    creator: a.artist,
    previewUrl: null,
    albumId: a.id,
    artistId: a.artistId,
    number: index + 1,
    disc: 1,
    durationSec: sec,
  };
}

function parseTrackId(id: string): { album: DemoAlbum; index: number } | null {
  const m = id.match(/^(demo-a\d+)-(\d+)$/);
  if (!m) return null;
  const album = DEMO_ALBUMS.find((a) => a.id === m[1]);
  const index = Number(m[2]) - 1;
  if (!album || index < 0 || index >= album.tracks.length) return null;
  return { album, index };
}

export class DemoMusicCatalog implements MusicCatalog {
  readonly live = false;

  async charts(kind: 'albums' | 'songs', ctx: CatalogContext) {
    await delay();
    if (kind === 'albums') return DEMO_ALBUMS.map((a) => albumSummary(a, ctx));
    return DEMO_TOP_SONGS.map(([albumId, n]) => {
      const album = DEMO_ALBUMS.find((a) => a.id === albumId)!;
      return trackItem(album, n - 1, ctx);
    });
  }

  async search(query: string, ctx: CatalogContext): Promise<MusicSearchResult> {
    await delay();
    const albums = DEMO_ALBUMS.filter((a) => matches(query, a.title, a.artist)).map((a) => albumSummary(a, ctx));
    const tracks: MediaSummary[] = [];
    for (const a of DEMO_ALBUMS) {
      a.tracks.forEach(([title], i) => {
        if (matches(query, title, a.artist)) tracks.push(trackItem(a, i, ctx));
      });
    }
    const artists = [
      ...new Map(
        DEMO_ALBUMS.filter((a) => matches(query, a.artist)).map((a) => [
          a.artistId,
          { id: a.artistId, name: a.artist, genre: a.genre[ctx.lang] },
        ]),
      ).values(),
    ];
    return { albums, tracks: tracks.slice(0, 25), artists };
  }

  async album(id: string, ctx: CatalogContext): Promise<AlbumDetails> {
    await delay();
    const a = DEMO_ALBUMS.find((x) => x.id === id);
    if (!a) throw new CatalogError('Not in the demo catalog', 404);
    const base = albumSummary(a, ctx);
    const durationSec = a.tracks.reduce((sum, [, sec]) => sum + sec, 0);
    return {
      ...base,
      kind: a.kind,
      artistName: a.artist,
      artistId: a.artistId,
      releaseDate: `${a.year}-01-01`,
      genreNames: [a.genre[ctx.lang]],
      copyright: null,
      tracks: a.tracks.map((_, i) => trackItem(a, i, ctx)),
      durationSec,
      externalUrl: null,
    };
  }

  async track(id: string, ctx: CatalogContext): Promise<TrackDetails> {
    await delay();
    const found = parseTrackId(id);
    if (!found) throw new CatalogError('Not in the demo catalog', 404);
    const { album, index } = found;
    return {
      ...trackItem(album, index, ctx),
      artistName: album.artist,
      artistId: album.artistId,
      album: albumSummary(album, ctx),
      releaseDate: `${album.year}-01-01`,
      genreNames: [album.genre[ctx.lang]],
      externalUrl: null,
    };
  }

  async artist(id: string, ctx: CatalogContext): Promise<ArtistDetails> {
    await delay();
    const albums = DEMO_ALBUMS.filter((a) => a.artistId === id);
    if (albums.length === 0) throw new CatalogError('Not in the demo catalog', 404);
    const sorted = [...albums].sort((a, b) => b.year - a.year);
    const topTracks = sorted.flatMap((a) => a.tracks.slice(0, 3).map((_, i) => trackItem(a, i, ctx))).slice(0, 10);
    return {
      id,
      name: albums[0].artist,
      genre: albums[0].genre[ctx.lang],
      image: null,
      albums: sorted.map((a) => albumSummary(a, ctx)),
      topTracks,
      externalUrl: null,
    };
  }

  async soundtracks(title: string, originalTitle: string | null, ctx: CatalogContext) {
    const names = [title, originalTitle].filter((n): n is string => !!n);
    return DEMO_ALBUMS.filter((a) => looksLikeSoundtrack(a.title) && names.some((n) => mentionsTitle(a.title, n))).map(
      (a) => albumSummary(a, ctx),
    );
  }
}

export function isDemoMusicId(id: string): boolean {
  return id.startsWith('demo-');
}

/** Snapshot of a bundled demo title (used to seed the demo community). */
export function demoSnapshot(type: string, id: string, ctx: CatalogContext): MediaSummary | null {
  if (type === 'movie' || type === 'tv') {
    const f = DEMO_FILMS.find((x) => x.type === type && x.id === id);
    return f ? filmSummary(f, ctx) : null;
  }
  if (type === 'album') {
    const a = DEMO_ALBUMS.find((x) => x.id === id);
    return a ? albumSummary(a, ctx) : null;
  }
  if (type === 'track') {
    const found = parseTrackId(id);
    return found ? trackItem(found.album, found.index, ctx) : null;
  }
  return null;
}
