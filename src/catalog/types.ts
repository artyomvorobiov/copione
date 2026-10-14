import type { Lang } from '@/i18n/lang';
import type { AlbumKind, MediaSummary } from '@/lib/types';

/** Language and country the catalogs should use. */
export interface CatalogContext {
  lang: Lang;
  /** ISO country code, e.g. "RU" or "US". */
  region: string;
}

export interface Provider {
  id: number;
  name: string;
  logo: string | null;
}

export interface WatchProviders {
  link: string | null;
  flatrate: Provider[];
  rent: Provider[];
  buy: Provider[];
}

export interface EpisodeInfo {
  season: number;
  episode: number;
  name: string;
  airDate: string | null;
  runtime: number | null;
  overview: string | null;
  still: string | null;
}

export interface SeasonSummary {
  season: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  poster: string | null;
}

export interface SeasonDetails {
  season: number;
  name: string;
  overview: string | null;
  poster: string | null;
  episodes: EpisodeInfo[];
}

export interface CastMember {
  name: string;
  character: string | null;
}

export interface FilmDetails extends MediaSummary {
  originalTitle: string | null;
  tagline: string | null;
  genreNames: string[];
  /** Directors for movies, creators for series. */
  directors: string[];
  cast: CastMember[];
  providers: WatchProviders | null;
  recommendations: MediaSummary[];
  trailerKey: string | null;
  releaseDate: string | null;
  // Series only
  seasons: SeasonSummary[];
  numberOfEpisodes: number | null;
  numberOfSeasons: number | null;
  nextEpisode: EpisodeInfo | null;
  lastEpisode: EpisodeInfo | null;
  status: string | null;
  inProduction: boolean;
}

export interface TrackItem extends MediaSummary {
  number: number;
  disc: number;
  durationSec: number | null;
}

export interface AlbumDetails extends MediaSummary {
  kind: AlbumKind;
  artistName: string;
  artistId: string | null;
  releaseDate: string | null;
  genreNames: string[];
  copyright: string | null;
  tracks: TrackItem[];
  durationSec: number | null;
  externalUrl: string | null;
}

export interface TrackDetails extends TrackItem {
  artistName: string;
  artistId: string | null;
  album: MediaSummary | null;
  releaseDate: string | null;
  genreNames: string[];
  externalUrl: string | null;
}

export interface ArtistSummary {
  id: string;
  name: string;
  genre: string | null;
}

export interface ArtistDetails extends ArtistSummary {
  image: string | null;
  albums: MediaSummary[];
  topTracks: TrackItem[];
  externalUrl: string | null;
}

export interface MusicSearchResult {
  albums: MediaSummary[];
  tracks: MediaSummary[];
  artists: ArtistSummary[];
}

export interface FilmCatalog {
  /** False for the bundled demo catalog. */
  readonly live: boolean;
  trending(type: 'movie' | 'tv', ctx: CatalogContext): Promise<MediaSummary[]>;
  search(query: string, ctx: CatalogContext): Promise<MediaSummary[]>;
  discover(
    type: 'movie' | 'tv',
    genres: number[],
    without: number[],
    ctx: CatalogContext,
    page?: number,
  ): Promise<MediaSummary[]>;
  details(type: 'movie' | 'tv', id: string, ctx: CatalogContext): Promise<FilmDetails>;
  season(showId: string, season: number, ctx: CatalogContext): Promise<SeasonDetails>;
  /** Best match for an imported title (Letterboxd export). */
  findMovie(title: string, year: number | null, ctx: CatalogContext): Promise<MediaSummary | null>;
}

export interface MusicCatalog {
  readonly live: boolean;
  charts(kind: 'albums' | 'songs', ctx: CatalogContext): Promise<MediaSummary[]>;
  search(query: string, ctx: CatalogContext): Promise<MusicSearchResult>;
  album(id: string, ctx: CatalogContext): Promise<AlbumDetails>;
  track(id: string, ctx: CatalogContext): Promise<TrackDetails>;
  artist(id: string, ctx: CatalogContext): Promise<ArtistDetails>;
  /** Soundtrack albums for a film or series title. */
  soundtracks(title: string, originalTitle: string | null, ctx: CatalogContext): Promise<MediaSummary[]>;
}

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}
