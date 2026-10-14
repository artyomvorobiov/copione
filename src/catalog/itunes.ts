import { yearOf } from '@/lib/dates';
import { looksLikeSoundtrack, mentionsTitle, normalizeTitle } from '@/lib/text';
import type { AlbumKind, MediaSummary } from '@/lib/types';

import { fetchJson, query } from './http';
import type {
  AlbumDetails,
  ArtistDetails,
  ArtistSummary,
  CatalogContext,
  MusicCatalog,
  MusicSearchResult,
  TrackDetails,
  TrackItem,
} from './types';
import { CatalogError } from './types';

/**
 * Music catalog backed by Apple's public iTunes Search API (no key needed).
 * Docs: https://performance-partners.apple.com/search-api
 * Albums: wrapperType "collection"; songs: wrapperType "track", kind "song".
 * Singles and EPs are named "… - Single" / "… - EP" by Apple.
 */
interface ItunesItem {
  wrapperType?: string;
  kind?: string;
  collectionType?: string;
  artistId?: number;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artistLinkUrl?: string;
  artistViewUrl?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackCount?: number;
  trackNumber?: number;
  discNumber?: number;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  collectionExplicitness?: string;
  trackExplicitness?: string;
  copyright?: string;
}

interface ItunesResponse {
  resultCount?: number;
  results?: ItunesItem[];
}

interface RssResponse {
  feed?: {
    results?: {
      id: string;
      name: string;
      artistName?: string;
      artistId?: string;
      artworkUrl100?: string;
      releaseDate?: string;
      genres?: { name: string }[];
    }[];
  };
}

const SUFFIX = / - (Single|EP)$/i;

export function albumKindFromName(name: string, artistName?: string, collectionType?: string): AlbumKind {
  const m = name.match(SUFFIX);
  if (m) return m[1].toLowerCase() === 'ep' ? 'ep' : 'single';
  if (collectionType === 'Compilation' || artistName === 'Various Artists') return 'compilation';
  return 'album';
}

export function cleanAlbumName(name: string): string {
  return name.replace(SUFFIX, '').trim();
}

function minutesFromMillis(ms: number | undefined | null): number | null {
  return ms ? Math.max(1, Math.round(ms / 60000)) : null;
}

function mapAlbum(r: ItunesItem): MediaSummary | null {
  if (!r.collectionId || !r.collectionName) return null;
  return {
    type: 'album',
    id: String(r.collectionId),
    title: cleanAlbumName(r.collectionName),
    subtitle: r.artistName ?? null,
    poster: r.artworkUrl100 ?? null,
    year: yearOf(r.releaseDate),
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    creator: r.artistName ?? null,
    kind: albumKindFromName(r.collectionName, r.artistName, r.collectionType),
    explicit: r.collectionExplicitness === 'explicit',
    artistId: r.artistId ? String(r.artistId) : null,
  };
}

function mapTrack(r: ItunesItem): TrackItem | null {
  if (!r.trackId || !r.trackName || (r.kind && r.kind !== 'song')) return null;
  return {
    type: 'track',
    id: String(r.trackId),
    title: r.trackName,
    subtitle: r.artistName ?? null,
    poster: r.artworkUrl100 ?? null,
    year: yearOf(r.releaseDate),
    genres: r.primaryGenreName ? [r.primaryGenreName] : [],
    runtime: minutesFromMillis(r.trackTimeMillis),
    creator: r.artistName ?? null,
    explicit: r.trackExplicitness === 'explicit',
    previewUrl: r.previewUrl ?? null,
    albumId: r.collectionId ? String(r.collectionId) : null,
    artistId: r.artistId ? String(r.artistId) : null,
    number: r.trackNumber ?? 0,
    disc: r.discNumber ?? 1,
    durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
  };
}

function dedupeAlbums(albums: MediaSummary[]): MediaSummary[] {
  // Apple often lists clean and explicit versions side by side; keep the first.
  const seen = new Set<string>();
  return albums.filter((a) => {
    const key = `${normalizeTitle(a.title)}|${normalizeTitle(a.subtitle ?? '')}|${a.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class ItunesCatalog implements MusicCatalog {
  readonly live = true;

  constructor(private readonly baseUrl: string) {}

  private params(ctx: CatalogContext) {
    return { country: ctx.region.toLowerCase(), lang: ctx.lang === 'ru' ? 'ru_ru' : 'en_us' };
  }

  private async call(path: 'search' | 'lookup', params: Record<string, string | number>, ctx: CatalogContext) {
    const url = `${this.baseUrl}/${path}?${query({ ...this.params(ctx), ...params })}`;
    try {
      return await fetchJson<ItunesResponse>(url);
    } catch (err) {
      if (err instanceof CatalogError && err.status === 403) {
        throw new CatalogError('Apple Music rate limit reached, try again in a minute', 429);
      }
      throw err;
    }
  }

  /** Lookups fail for items missing from the local storefront; retry in the US one. */
  private async lookup(params: Record<string, string | number>, ctx: CatalogContext): Promise<ItunesItem[]> {
    const res = await this.call('lookup', params, ctx);
    if ((res.results?.length ?? 0) > 0 || ctx.region.toUpperCase() === 'US') return res.results ?? [];
    const fallback = await this.call('lookup', params, { ...ctx, region: 'US' });
    return fallback.results ?? [];
  }

  async charts(kind: 'albums' | 'songs', ctx: CatalogContext): Promise<MediaSummary[]> {
    const country = ctx.region.toLowerCase();
    const hosts = ['https://rss.marketingtools.apple.com', 'https://rss.applemarketingtools.com'];
    let lastError: unknown = null;
    for (const host of hosts) {
      try {
        const res = await fetchJson<RssResponse>(`${host}/api/v2/${country}/music/most-played/25/${kind}.json`);
        return (res.feed?.results ?? []).map((r) => ({
          type: kind === 'albums' ? 'album' : 'track',
          id: String(r.id),
          title: kind === 'albums' ? cleanAlbumName(r.name) : r.name,
          subtitle: r.artistName ?? null,
          poster: r.artworkUrl100 ?? null,
          year: yearOf(r.releaseDate),
          genres: (r.genres ?? []).map((g) => g.name).filter((g) => g !== 'Music' && g !== 'Музыка').slice(0, 1),
          creator: r.artistName ?? null,
          kind: kind === 'albums' ? albumKindFromName(r.name, r.artistName) : null,
          artistId: r.artistId ?? null,
        }));
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new CatalogError('charts unavailable');
  }

  async search(term: string, ctx: CatalogContext): Promise<MusicSearchResult> {
    const [albumsRes, songsRes] = await Promise.all([
      this.call('search', { term, media: 'music', entity: 'album', limit: 25 }, ctx),
      this.call('search', { term, media: 'music', entity: 'song', limit: 25 }, ctx),
    ]);
    const albums = dedupeAlbums(
      (albumsRes.results ?? []).map(mapAlbum).filter((a): a is MediaSummary => !!a),
    );
    const tracks = (songsRes.results ?? []).map(mapTrack).filter((t): t is TrackItem => !!t);

    // Artists are not searched separately (to save requests) but derived from results.
    const counts = new Map<string, { artist: ArtistSummary; n: number }>();
    for (const item of [...(albumsRes.results ?? []), ...(songsRes.results ?? [])]) {
      if (!item.artistId || !item.artistName || item.artistName === 'Various Artists') continue;
      const id = String(item.artistId);
      const entry = counts.get(id) ?? { artist: { id, name: item.artistName, genre: item.primaryGenreName ?? null }, n: 0 };
      entry.n += 1;
      counts.set(id, entry);
    }
    const artists = [...counts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map((x) => x.artist);

    return { albums, tracks, artists };
  }

  async album(id: string, ctx: CatalogContext): Promise<AlbumDetails> {
    const items = await this.lookup({ id, entity: 'song', limit: 200 }, ctx);
    const head = items.find((r) => r.wrapperType === 'collection');
    const base = head ? mapAlbum(head) : null;
    if (!head || !base) throw new CatalogError('Album not found', 404);
    const tracks = items
      .filter((r) => r.wrapperType === 'track')
      .map(mapTrack)
      .filter((t): t is TrackItem => !!t)
      .sort((a, b) => a.disc - b.disc || a.number - b.number);
    const durationSec = tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0) || null;
    return {
      ...base,
      runtime: durationSec ? Math.round(durationSec / 60) : null,
      kind: base.kind ?? 'album',
      artistName: head.artistName ?? '',
      artistId: head.artistId ? String(head.artistId) : null,
      releaseDate: head.releaseDate ? head.releaseDate.slice(0, 10) : null,
      genreNames: head.primaryGenreName ? [head.primaryGenreName] : [],
      copyright: head.copyright ?? null,
      tracks,
      durationSec,
      externalUrl: head.collectionViewUrl ?? null,
    };
  }

  async track(id: string, ctx: CatalogContext): Promise<TrackDetails> {
    const items = await this.lookup({ id }, ctx);
    const raw = items.find((r) => r.wrapperType === 'track');
    const track = raw ? mapTrack(raw) : null;
    if (!raw || !track) throw new CatalogError('Track not found', 404);
    return {
      ...track,
      artistName: raw.artistName ?? '',
      artistId: raw.artistId ? String(raw.artistId) : null,
      album: raw.collectionId
        ? {
            type: 'album',
            id: String(raw.collectionId),
            title: cleanAlbumName(raw.collectionName ?? ''),
            subtitle: raw.artistName ?? null,
            poster: raw.artworkUrl100 ?? null,
            year: yearOf(raw.releaseDate),
            kind: albumKindFromName(raw.collectionName ?? '', raw.artistName),
          }
        : null,
      releaseDate: raw.releaseDate ? raw.releaseDate.slice(0, 10) : null,
      genreNames: raw.primaryGenreName ? [raw.primaryGenreName] : [],
      externalUrl: raw.trackViewUrl ?? null,
    };
  }

  async artist(id: string, ctx: CatalogContext): Promise<ArtistDetails> {
    const [albumItems, songItems] = await Promise.all([
      this.lookup({ id, entity: 'album', limit: 100 }, ctx),
      this.lookup({ id, entity: 'song', limit: 15 }, ctx),
    ]);
    const head = albumItems.find((r) => r.wrapperType === 'artist') ?? songItems.find((r) => r.wrapperType === 'artist');
    if (!head) throw new CatalogError('Artist not found', 404);
    const albums = dedupeAlbums(
      albumItems
        .filter((r) => r.wrapperType === 'collection')
        .map(mapAlbum)
        .filter((a): a is MediaSummary => !!a)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    );
    return {
      id,
      name: head.artistName ?? '',
      genre: head.primaryGenreName ?? null,
      image: albums[0]?.poster ?? null,
      albums,
      topTracks: songItems.map(mapTrack).filter((t): t is TrackItem => !!t),
      externalUrl: head.artistLinkUrl ?? head.artistViewUrl ?? null,
    };
  }

  async soundtracks(title: string, originalTitle: string | null, ctx: CatalogContext): Promise<MediaSummary[]> {
    const names = [...new Set([originalTitle, title].filter((n): n is string => !!n))];
    for (const name of names) {
      const res = await this.call('search', { term: `${name} soundtrack`, media: 'music', entity: 'album', limit: 15 }, ctx);
      const found = dedupeAlbums(
        (res.results ?? [])
          .map(mapAlbum)
          .filter((a): a is MediaSummary => !!a)
          .filter((a) => looksLikeSoundtrack(a.title) && names.some((n) => mentionsTitle(a.title, n))),
      );
      if (found.length > 0) return found.slice(0, 3);
    }
    return [];
  }
}
