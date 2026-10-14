import { config } from '@/config';
import type { MediaSummary } from '@/lib/types';

import { DemoFilmCatalog, DemoMusicCatalog, isDemoMusicId } from './demo';
import { ItunesCatalog } from './itunes';
import { TmdbCatalog } from './tmdb';
import type { CatalogContext, FilmCatalog, MusicCatalog } from './types';

export * from './types';

/**
 * Music ids starting with "demo-" always come from the bundled demo albums
 * (the demo community talks about them); everything else from Apple Music.
 */
class RoutedMusicCatalog implements MusicCatalog {
  constructor(
    private readonly liveCatalog: MusicCatalog | null,
    private readonly demo: MusicCatalog,
  ) {}

  get live() {
    return !!this.liveCatalog;
  }

  private pick(id?: string): MusicCatalog {
    if (!this.liveCatalog || (id && isDemoMusicId(id))) return this.demo;
    return this.liveCatalog;
  }

  charts(kind: 'albums' | 'songs', ctx: CatalogContext) {
    return this.pick().charts(kind, ctx);
  }

  search(query: string, ctx: CatalogContext) {
    return this.pick().search(query, ctx);
  }

  album(id: string, ctx: CatalogContext) {
    return this.pick(id).album(id, ctx);
  }

  track(id: string, ctx: CatalogContext) {
    return this.pick(id).track(id, ctx);
  }

  artist(id: string, ctx: CatalogContext) {
    return this.pick(id).artist(id, ctx);
  }

  async soundtracks(title: string, originalTitle: string | null, ctx: CatalogContext): Promise<MediaSummary[]> {
    return this.pick().soundtracks(title, originalTitle, ctx);
  }
}

export function createFilmCatalog(): FilmCatalog {
  return config.hasTmdb ? new TmdbCatalog(config.tmdbKey, config.tmdbApiBase) : new DemoFilmCatalog();
}

export function createMusicCatalog(): MusicCatalog {
  return new RoutedMusicCatalog(config.liveMusic ? new ItunesCatalog(config.itunesApiBase) : null, new DemoMusicCatalog());
}

export type ImageSize = 'thumb' | 'card' | 'large' | 'backdrop' | 'logo';

const TMDB_SIZES: Record<ImageSize, string> = {
  thumb: 'w154',
  card: 'w342',
  large: 'w500',
  backdrop: 'w1280',
  logo: 'w92',
};

const ARTWORK_PX: Record<ImageSize, number> = {
  thumb: 200,
  card: 400,
  large: 600,
  backdrop: 1000,
  logo: 100,
};

/** Full image URL for a TMDB path or an Apple artwork URL (resized). */
export function imageUrl(poster: string | null | undefined, size: ImageSize): string | null {
  if (!poster) return null;
  if (poster.startsWith('http')) {
    const px = ARTWORK_PX[size];
    return poster.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${px}x${px}bb.$1`);
  }
  if (poster.startsWith('/')) return `${config.tmdbImageBase}/${TMDB_SIZES[size]}${poster}`;
  return null;
}
