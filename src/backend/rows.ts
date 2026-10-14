import { isMediaType } from '@/lib/media';
import type {
  Comment,
  Entry,
  EntryCard,
  EntryInput,
  LibraryItem,
  LibraryStatus,
  MediaSnapshot,
  MediaType,
  Profile,
  ProfileLite,
  TitleStats,
} from '@/lib/types';

/* Database row shapes (snake_case, as returned by PostgREST). */

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_emoji: string | null;
  fav_films: unknown;
  fav_music: unknown;
  goal_films: number | null;
  goal_albums: number | null;
  created_at: string;
}

export interface SnapshotColumns {
  media_type: string;
  media_id: string;
  title: string;
  subtitle: string | null;
  poster: string | null;
  year: number | null;
  genres?: string[] | null;
  runtime?: number | null;
  creator?: string | null;
}

export interface LibraryRow extends SnapshotColumns {
  user_id: string;
  status: string | null;
  rating: number | string | null;
  liked: boolean;
  updated_at: string;
}

export interface EntryRow extends SnapshotColumns {
  id: string;
  user_id: string;
  season: number | null;
  watched_on: string;
  rating: number | string | null;
  liked: boolean;
  rewatch: boolean;
  review: string | null;
  spoilers: boolean;
  vibes: string[] | null;
  created_at: string;
}

export interface EntryCardRow extends EntryRow {
  author_username: string;
  author_display_name: string | null;
  author_avatar_emoji: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface CommentCardRow {
  id: string;
  entry_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_username: string;
  author_display_name: string | null;
  author_avatar_emoji: string | null;
}

export function num(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mediaType(value: string): MediaType {
  if (!isMediaType(value)) throw new Error(`Unknown media type ${value}`);
  return value;
}

export function snapshotFromRow(row: SnapshotColumns): MediaSnapshot {
  return {
    type: mediaType(row.media_type),
    id: row.media_id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    poster: row.poster ?? null,
    year: row.year ?? null,
    genres: row.genres ?? [],
    runtime: row.runtime ?? null,
    creator: row.creator ?? null,
  };
}

export function snapshotColumns(m: MediaSnapshot): SnapshotColumns {
  return {
    media_type: m.type,
    media_id: String(m.id),
    title: m.title.slice(0, 300),
    subtitle: m.subtitle ? m.subtitle.slice(0, 300) : null,
    poster: m.poster ? m.poster.slice(0, 500) : null,
    year: m.year ?? null,
    genres: (m.genres ?? []).slice(0, 12),
    runtime: m.runtime != null ? Math.round(m.runtime) : null,
    creator: m.creator ? m.creator.slice(0, 200) : null,
  };
}

/** Snapshots stored in jsonb columns (favorites, Match decks) may be partial. */
export function snapshotFromJson(value: unknown): MediaSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!isMediaType(v.type) || v.id == null || typeof v.title !== 'string') return null;
  return {
    type: v.type,
    id: String(v.id),
    title: v.title,
    subtitle: typeof v.subtitle === 'string' ? v.subtitle : null,
    poster: typeof v.poster === 'string' ? v.poster : null,
    year: typeof v.year === 'number' ? v.year : null,
    genres: Array.isArray(v.genres) ? v.genres.map(String) : [],
    runtime: typeof v.runtime === 'number' ? v.runtime : null,
    creator: typeof v.creator === 'string' ? v.creator : null,
  };
}

export function snapshotList(value: unknown): MediaSnapshot[] {
  return Array.isArray(value) ? value.map(snapshotFromJson).filter((m): m is MediaSnapshot => !!m) : [];
}

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? '',
    avatarEmoji: row.avatar_emoji ?? null,
    bio: row.bio ?? '',
    favFilms: snapshotList(row.fav_films),
    favMusic: snapshotList(row.fav_music),
    goalFilms: row.goal_films ?? null,
    goalAlbums: row.goal_albums ?? null,
    createdAt: row.created_at,
  };
}

export function liteFromRow(row: Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_emoji'>): ProfileLite {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? '',
    avatarEmoji: row.avatar_emoji ?? null,
  };
}

function status(value: string | null): LibraryStatus | null {
  return value === 'want' || value === 'done' ? value : null;
}

export function libraryFromRow(row: LibraryRow): LibraryItem {
  return {
    userId: row.user_id,
    media: snapshotFromRow(row),
    status: status(row.status),
    rating: num(row.rating),
    liked: !!row.liked,
    updatedAt: row.updated_at,
  };
}

export function entryFromRow(row: EntryRow): Entry {
  return {
    id: row.id,
    userId: row.user_id,
    media: snapshotFromRow(row),
    season: row.season ?? null,
    watchedOn: row.watched_on,
    rating: num(row.rating),
    liked: !!row.liked,
    rewatch: !!row.rewatch,
    review: row.review ?? null,
    spoilers: !!row.spoilers,
    vibes: row.vibes ?? [],
    createdAt: row.created_at,
  };
}

export function entryCardFromRow(row: EntryCardRow): EntryCard {
  return {
    ...entryFromRow(row),
    author: {
      id: row.user_id,
      username: row.author_username,
      displayName: row.author_display_name ?? '',
      avatarEmoji: row.author_avatar_emoji ?? null,
    },
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    likedByMe: !!row.liked_by_me,
  };
}

export function commentFromRow(row: CommentCardRow): Comment {
  return {
    id: row.id,
    entryId: row.entry_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.author_username,
      displayName: row.author_display_name ?? '',
      avatarEmoji: row.author_avatar_emoji ?? null,
    },
  };
}

export function entryColumns(userId: string, input: EntryInput) {
  const review = input.review?.trim() ? input.review.trim().slice(0, 8000) : null;
  return {
    user_id: userId,
    ...snapshotColumns(input.media),
    season: input.media.type === 'tv' ? input.season : null,
    watched_on: input.watchedOn,
    rating: input.rating,
    liked: input.liked,
    rewatch: input.rewatch,
    review,
    spoilers: review ? input.spoilers : false,
    vibes: input.vibes.slice(0, 3),
  };
}

export function statsFromJson(value: unknown): TitleStats {
  const v = (value ?? {}) as Record<string, unknown>;
  const histogram = Array.isArray(v.histogram) ? v.histogram.map((x) => Number(x) || 0) : [];
  while (histogram.length < 10) histogram.push(0);
  return {
    avg: num(v.avg as number | string | null),
    count: Number(v.count) || 0,
    histogram: histogram.slice(0, 10),
    done: Number(v.done) || 0,
    want: Number(v.want) || 0,
    liked: Number(v.liked) || 0,
    vibes: Array.isArray(v.vibes)
      ? v.vibes
          .map((x) => x as { id?: unknown; count?: unknown })
          .filter((x) => typeof x.id === 'string')
          .map((x) => ({ id: x.id as string, count: Number(x.count) || 0 }))
      : [],
    vibeEntries: Number(v.vibe_entries) || 0,
  };
}
