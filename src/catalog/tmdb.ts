import { tmdbLanguage } from '@/i18n/lang';
import { yearOf } from '@/lib/dates';
import { normalizeTitle } from '@/lib/text';
import type { MediaSummary } from '@/lib/types';

import { fetchJson, query } from './http';
import type {
  CatalogContext,
  EpisodeInfo,
  FilmCatalog,
  FilmDetails,
  Provider,
  SeasonDetails,
  SeasonSummary,
  WatchProviders,
} from './types';

/* Raw TMDB shapes (only the fields we use). */
interface RawResult {
  id: number;
  media_type?: string;
  title?: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
}

interface RawPage {
  results?: RawResult[];
}

interface RawEpisode {
  season_number: number;
  episode_number: number;
  name?: string;
  air_date?: string | null;
  runtime?: number | null;
  overview?: string;
  still_path?: string | null;
}

interface RawProviderList {
  link?: string;
  flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[];
  rent?: { provider_id: number; provider_name: string; logo_path: string | null }[];
  buy?: { provider_id: number; provider_name: string; logo_path: string | null }[];
}

interface RawDetails extends RawResult {
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  tagline?: string;
  status?: string;
  in_production?: boolean;
  number_of_episodes?: number;
  number_of_seasons?: number;
  created_by?: { name: string }[];
  seasons?: {
    season_number: number;
    name?: string;
    episode_count?: number;
    air_date?: string | null;
    poster_path?: string | null;
  }[];
  next_episode_to_air?: RawEpisode | null;
  last_episode_to_air?: RawEpisode | null;
  credits?: {
    cast?: { name: string; character?: string; order?: number }[];
    crew?: { name: string; job?: string }[];
  };
  videos?: { results?: { key: string; site: string; type: string; official?: boolean }[] };
  recommendations?: RawPage;
  'watch/providers'?: { results?: Record<string, RawProviderList> };
}

function mapResult(r: RawResult, forcedType?: 'movie' | 'tv'): MediaSummary | null {
  const type = forcedType ?? r.media_type;
  if ((type !== 'movie' && type !== 'tv') || r.adult) return null;
  const title = (type === 'movie' ? r.title || r.original_title : r.name || r.original_name) ?? '';
  const original = type === 'movie' ? r.original_title : r.original_name;
  if (!title) return null;
  return {
    type,
    id: String(r.id),
    title,
    subtitle: original && normalizeTitle(original) !== normalizeTitle(title) ? original : null,
    poster: r.poster_path ?? null,
    backdrop: r.backdrop_path ?? null,
    year: yearOf(type === 'movie' ? r.release_date : r.first_air_date),
    genres: (r.genre_ids ?? []).map(String),
    overview: r.overview || null,
    score: typeof r.vote_average === 'number' && (r.vote_count ?? 0) > 0 ? r.vote_average : null,
  };
}

function mapEpisode(e: RawEpisode | null | undefined): EpisodeInfo | null {
  if (!e) return null;
  return {
    season: e.season_number,
    episode: e.episode_number,
    name: e.name ?? '',
    airDate: e.air_date || null,
    runtime: e.runtime ?? null,
    overview: e.overview || null,
    still: e.still_path ?? null,
  };
}

function mapProviders(raw: RawProviderList | undefined): WatchProviders | null {
  if (!raw) return null;
  const map = (list: RawProviderList['flatrate']): Provider[] =>
    (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));
  const providers = { link: raw.link ?? null, flatrate: map(raw.flatrate), rent: map(raw.rent), buy: map(raw.buy) };
  return providers.flatrate.length + providers.rent.length + providers.buy.length > 0 ? providers : null;
}

export class TmdbCatalog implements FilmCatalog {
  readonly live = true;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  private async get<T>(path: string, params: Record<string, string | number | boolean | null | undefined>) {
    // A v4 "Read Access Token" is a JWT; a v3 "API Key" is a short hex string.
    const bearer = this.apiKey.startsWith('eyJ');
    const qs = query(bearer ? params : { ...params, api_key: this.apiKey });
    return fetchJson<T>(`${this.baseUrl}${path}?${qs}`, {
      headers: bearer ? { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' } : { Accept: 'application/json' },
    });
  }

  async trending(type: 'movie' | 'tv', ctx: CatalogContext) {
    const page = await this.get<RawPage>(`/trending/${type}/week`, { language: tmdbLanguage(ctx.lang) });
    return (page.results ?? []).map((r) => mapResult(r, type)).filter((m): m is MediaSummary => !!m);
  }

  async search(q: string, ctx: CatalogContext) {
    const page = await this.get<RawPage>('/search/multi', {
      query: q,
      language: tmdbLanguage(ctx.lang),
      include_adult: false,
    });
    return (page.results ?? []).map((r) => mapResult(r)).filter((m): m is MediaSummary => !!m);
  }

  async discover(type: 'movie' | 'tv', genres: number[], without: number[], ctx: CatalogContext, page = 1) {
    const res = await this.get<RawPage>(`/discover/${type}`, {
      language: tmdbLanguage(ctx.lang),
      with_genres: genres.join('|'),
      without_genres: without.join(','),
      sort_by: 'popularity.desc',
      'vote_count.gte': type === 'movie' ? 300 : 100,
      'vote_average.gte': 6.3,
      include_adult: false,
      page,
    });
    return (res.results ?? []).map((r) => mapResult(r, type)).filter((m): m is MediaSummary => !!m);
  }

  async details(type: 'movie' | 'tv', id: string, ctx: CatalogContext): Promise<FilmDetails> {
    const lang = tmdbLanguage(ctx.lang);
    const raw = await this.get<RawDetails>(`/${type}/${id}`, {
      language: lang,
      append_to_response: 'credits,videos,recommendations,watch/providers',
      include_video_language: `${ctx.lang},en,null`,
    });
    let overview = raw.overview || null;
    if (!overview && ctx.lang !== 'en') {
      // Not every title has a translated synopsis — fall back to English.
      const fallback = await this.get<RawDetails>(`/${type}/${id}`, { language: 'en-US' }).catch(() => null);
      overview = fallback?.overview || null;
    }
    const base = mapResult(raw, type);
    if (!base) throw new Error(`Unsupported TMDB item ${type}/${id}`);

    const directors =
      type === 'movie'
        ? (raw.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name)
        : (raw.created_by ?? []).map((c) => c.name);
    const trailer = (raw.videos?.results ?? []).find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
    );
    const seasons: SeasonSummary[] = (raw.seasons ?? []).map((s) => ({
      season: s.season_number,
      name: s.name ?? '',
      episodeCount: s.episode_count ?? 0,
      airDate: s.air_date ?? null,
      poster: s.poster_path ?? null,
    }));
    const lastEpisode = mapEpisode(raw.last_episode_to_air);
    const runtime =
      type === 'movie' ? raw.runtime ?? null : raw.episode_run_time?.[0] ?? lastEpisode?.runtime ?? null;
    const uniqueDirectors = [...new Set(directors)];

    return {
      ...base,
      overview,
      genres: (raw.genres ?? []).map((g) => String(g.id)),
      genreNames: (raw.genres ?? []).map((g) => g.name),
      runtime,
      creator: uniqueDirectors.slice(0, 2).join(', ') || null,
      originalTitle: (type === 'movie' ? raw.original_title : raw.original_name) ?? null,
      tagline: raw.tagline || null,
      directors: uniqueDirectors,
      cast: (raw.credits?.cast ?? [])
        .slice(0, 15)
        .map((c) => ({ name: c.name, character: c.character || null })),
      providers: mapProviders(raw['watch/providers']?.results?.[ctx.region]),
      recommendations: (raw.recommendations?.results ?? [])
        .map((r) => mapResult(r, type))
        .filter((m): m is MediaSummary => !!m)
        .slice(0, 15),
      trailerKey: trailer?.key ?? null,
      releaseDate: (type === 'movie' ? raw.release_date : raw.first_air_date) || null,
      seasons,
      numberOfEpisodes: raw.number_of_episodes ?? null,
      numberOfSeasons: raw.number_of_seasons ?? null,
      nextEpisode: mapEpisode(raw.next_episode_to_air),
      lastEpisode,
      status: raw.status ?? null,
      inProduction: !!raw.in_production,
    };
  }

  async season(showId: string, season: number, ctx: CatalogContext): Promise<SeasonDetails> {
    const raw = await this.get<{
      season_number: number;
      name?: string;
      overview?: string;
      poster_path?: string | null;
      episodes?: RawEpisode[];
    }>(`/tv/${showId}/season/${season}`, { language: tmdbLanguage(ctx.lang) });
    return {
      season: raw.season_number,
      name: raw.name ?? '',
      overview: raw.overview || null,
      poster: raw.poster_path ?? null,
      episodes: (raw.episodes ?? []).map((e) => mapEpisode(e)).filter((e): e is EpisodeInfo => !!e),
    };
  }

  async findMovie(title: string, year: number | null, ctx: CatalogContext) {
    const page = await this.get<RawPage>('/search/movie', {
      query: title,
      year: year ?? undefined,
      language: tmdbLanguage(ctx.lang),
      include_adult: false,
    });
    let results = (page.results ?? []).map((r) => mapResult(r, 'movie')).filter((m): m is MediaSummary => !!m);
    if (results.length === 0 && year) {
      // Release years differ between countries; retry without the year.
      const loose = await this.get<RawPage>('/search/movie', { query: title, language: tmdbLanguage(ctx.lang) });
      results = (loose.results ?? []).map((r) => mapResult(r, 'movie')).filter((m): m is MediaSummary => !!m);
    }
    if (results.length === 0) return null;
    const wanted = normalizeTitle(title);
    const exact = results.find(
      (m) =>
        (normalizeTitle(m.title) === wanted || normalizeTitle(m.subtitle ?? '') === wanted) &&
        (!year || !m.year || Math.abs(m.year - year) <= 1),
    );
    return exact ?? results[0];
  }
}
