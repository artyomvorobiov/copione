import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import type {
  Comment,
  DeckItem,
  Domain,
  Entry,
  EntryCard,
  EntryInput,
  EpisodeKey,
  EpisodeMark,
  FriendRating,
  LibraryFilter,
  LibraryItem,
  LibraryPatch,
  ListDetail,
  ListInput,
  ListSummary,
  MatchKind,
  MatchRoom,
  MatchRoomSummary,
  MatchState,
  MediaRef,
  MediaSnapshot,
  MediaType,
  ProfileCard,
  ProfileLite,
  ProfilePatch,
  ReportInput,
  SeenEpisode,
  ShowInProgress,
  TastePair,
  TitleStats,
} from '@/lib/types';
import { FILM_TYPES, MUSIC_TYPES } from '@/lib/types';

import {
  type CommentCardRow,
  commentFromRow,
  type EntryCardRow,
  entryCardFromRow,
  entryColumns,
  entryFromRow,
  type EntryRow,
  liteFromRow,
  type LibraryRow,
  libraryFromRow,
  num,
  profileFromRow,
  type ProfileRow,
  snapshotColumns,
  snapshotFromJson,
  snapshotFromRow,
  statsFromJson,
} from './rows';
import { type Backend, BackendError, type PageOptions } from './types';

const PAGE = 1000;
const LITE_COLUMNS = 'id, username, display_name, avatar_emoji';

function toBackendError(error: PostgrestError | Error | { message?: string; code?: string }): BackendError {
  const message = error.message ?? '';
  const code = 'code' in error ? error.code : undefined;
  if (message.includes('room not found')) return new BackendError('room_not_found', message);
  if (message.includes('room is full')) return new BackendError('room_full', message);
  if (code === '23505' && message.includes('username')) return new BackendError('username_taken', message);
  if (code === '42501' || code === 'PGRST301') return new BackendError('forbidden', message);
  if (/network|fetch|timed? ?out/i.test(message)) return new BackendError('network', message);
  return new BackendError('unknown', message);
}

/** Unwraps a supabase-js response or throws a BackendError. */
function check<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw toBackendError(res.error);
  return res.data as T;
}

function typesFor(domain?: Domain): readonly MediaType[] | null {
  if (!domain) return null;
  return domain === 'film' ? FILM_TYPES : MUSIC_TYPES;
}

function roomFromJson(value: unknown): MatchRoom {
  const row = (Array.isArray(value) ? value[0] : value) as {
    id: string;
    code: string;
    host_id: string;
    kind: MatchKind;
    deck: unknown;
    created_at: string;
  };
  const deck = Array.isArray(row.deck)
    ? row.deck
        .map((raw): DeckItem | null => {
          const snap = snapshotFromJson(raw);
          if (!snap) return null;
          const r = raw as { overview?: unknown; score?: unknown };
          return {
            ...snap,
            overview: typeof r.overview === 'string' ? r.overview : null,
            score: typeof r.score === 'number' ? r.score : null,
          };
        })
        .filter((d): d is DeckItem => !!d)
    : [];
  return { id: row.id, code: row.code, hostId: row.host_id, kind: row.kind, deck, createdAt: row.created_at };
}

export class SupabaseBackend implements Backend {
  readonly kind = 'cloud' as const;

  constructor(
    private readonly db: SupabaseClient,
    readonly userId: string,
  ) {}

  /** Reads every page of a query (PostgREST caps responses at 1000 rows). */
  private async fetchAll<T>(
    build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = check(await build(from, from + PAGE - 1)) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  private async profilesByIds(ids: string[]): Promise<ProfileLite[]> {
    if (ids.length === 0) return [];
    const rows = check(await this.db.from('profiles').select(LITE_COLUMNS).in('id', ids)) as ProfileRow[];
    const byId = new Map(rows.map((r) => [r.id, liteFromRow(r)]));
    return ids.map((id) => byId.get(id)).filter((p): p is ProfileLite => !!p);
  }

  /* Profiles ------------------------------------------------------------- */

  async getProfile(userId: string): Promise<ProfileCard | null> {
    const data = check(await this.db.rpc('profile_card', { p_user: userId })) as Record<string, unknown> | null;
    if (!data || !data.profile) return null;
    return {
      ...profileFromRow(data.profile as ProfileRow),
      followers: Number(data.followers) || 0,
      following: Number(data.following) || 0,
      isMe: userId === this.userId,
      isFollowing: !!data.is_following,
      followsMe: !!data.follows_me,
      isBlocked: !!data.is_blocked,
      counts: {
        films: Number(data.films) || 0,
        shows: Number(data.shows) || 0,
        albums: Number(data.albums) || 0,
        tracks: Number(data.tracks) || 0,
        entriesThisYear: Number(data.entries_this_year) || 0,
      },
    };
  }

  async updateProfile(patch: ProfilePatch): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.username !== undefined) row.username = patch.username.toLowerCase();
    if (patch.displayName !== undefined) row.display_name = patch.displayName.slice(0, 40);
    if (patch.bio !== undefined) row.bio = patch.bio.slice(0, 300);
    if (patch.avatarEmoji !== undefined) row.avatar_emoji = patch.avatarEmoji;
    if (patch.favFilms !== undefined) row.fav_films = patch.favFilms.slice(0, 4);
    if (patch.favMusic !== undefined) row.fav_music = patch.favMusic.slice(0, 4);
    if (patch.goalFilms !== undefined) row.goal_films = patch.goalFilms;
    if (patch.goalAlbums !== undefined) row.goal_albums = patch.goalAlbums;
    if (Object.keys(row).length === 0) return;
    check(await this.db.from('profiles').update(row).eq('id', this.userId));
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    return !!check(await this.db.rpc('username_available', { p_username: username }));
  }

  async searchProfiles(query: string): Promise<ProfileLite[]> {
    const q = query.trim().replace(/^@/, '');
    if (!q) return [];
    const rows = check(await this.db.rpc('search_profiles', { p_query: q })) as ProfileRow[];
    return rows.map(liteFromRow);
  }

  async suggestedProfiles(): Promise<ProfileLite[]> {
    const rows = check(await this.db.rpc('suggested_profiles', { p_limit: 12 })) as ProfileRow[];
    return rows.map(liteFromRow);
  }

  async listFollows(userId: string, kind: 'followers' | 'following'): Promise<ProfileLite[]> {
    const [match, pick] = kind === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
    const rows = check(
      await this.db.from('follows').select(pick).eq(match, userId).order('created_at', { ascending: false }).limit(500),
    ) as unknown as Record<string, string>[];
    return this.profilesByIds(rows.map((r) => r[pick]));
  }

  async setFollow(userId: string, follow: boolean): Promise<void> {
    if (follow) {
      check(
        await this.db
          .from('follows')
          .upsert({ follower_id: this.userId, followee_id: userId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }),
      );
    } else {
      check(await this.db.from('follows').delete().eq('follower_id', this.userId).eq('followee_id', userId));
    }
  }

  async setBlock(userId: string, block: boolean): Promise<void> {
    if (block) {
      check(
        await this.db
          .from('blocks')
          .upsert({ blocker_id: this.userId, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }),
      );
      await this.setFollow(userId, false);
    } else {
      check(await this.db.from('blocks').delete().eq('blocker_id', this.userId).eq('blocked_id', userId));
    }
  }

  async listBlocked(): Promise<ProfileLite[]> {
    const rows = check(await this.db.from('blocks').select('blocked_id').eq('blocker_id', this.userId)) as {
      blocked_id: string;
    }[];
    return this.profilesByIds(rows.map((r) => r.blocked_id));
  }

  async report(input: ReportInput): Promise<void> {
    check(
      await this.db.from('reports').insert({
        reporter_id: this.userId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason.slice(0, 500),
      }),
    );
  }

  /* Library -------------------------------------------------------------- */

  async getLibraryItems(refs: MediaRef[]): Promise<LibraryItem[]> {
    const byType = new Map<MediaType, string[]>();
    for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), String(r.id)]);
    const results = await Promise.all(
      [...byType.entries()].map(async ([type, ids]) =>
        check(
          await this.db
            .from('library')
            .select('*')
            .eq('user_id', this.userId)
            .eq('media_type', type)
            .in('media_id', [...new Set(ids)]),
        ) as LibraryRow[],
      ),
    );
    return results.flat().map(libraryFromRow);
  }

  async setLibrary(media: MediaSnapshot, patch: LibraryPatch): Promise<void> {
    const row: Record<string, unknown> = { user_id: this.userId, ...snapshotColumns(media) };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.rating !== undefined) row.rating = patch.rating;
    if (patch.liked !== undefined) row.liked = patch.liked;
    check(await this.db.from('library').upsert(row, { onConflict: 'user_id,media_type,media_id' }));
  }

  async getUserLibrary(userId: string, filter: LibraryFilter, domain?: Domain): Promise<LibraryItem[]> {
    const types = typesFor(domain);
    const rows = await this.fetchAll<LibraryRow>((from, to) => {
      let q = this.db.from('library').select('*').eq('user_id', userId);
      if (filter === 'done') q = q.eq('status', 'done');
      if (filter === 'want') q = q.eq('status', 'want');
      if (filter === 'liked') q = q.eq('liked', true);
      if (filter === 'rated') q = q.not('rating', 'is', null);
      if (types) q = q.in('media_type', [...types]);
      return q.order('updated_at', { ascending: false }).range(from, to);
    });
    return rows.map(libraryFromRow);
  }

  async tastePairs(otherUserId: string): Promise<TastePair[]> {
    const rows = check(await this.db.rpc('taste_pairs', { p_other: otherUserId })) as (LibraryRow & {
      my_rating: number;
      their_rating: number;
    })[];
    return rows.map((r) => ({
      media: snapshotFromRow(r),
      mine: num(r.my_rating) ?? 0,
      theirs: num(r.their_rating) ?? 0,
    }));
  }

  /* Diary ---------------------------------------------------------------- */

  async addEntry(input: EntryInput): Promise<string> {
    const row = check(await this.db.from('entries').insert(entryColumns(this.userId, input)).select('id').single()) as {
      id: string;
    };
    return row.id;
  }

  async updateEntry(id: string, input: EntryInput): Promise<void> {
    check(await this.db.from('entries').update(entryColumns(this.userId, input)).eq('id', id).eq('user_id', this.userId));
  }

  async deleteEntry(id: string): Promise<void> {
    check(await this.db.from('entries').delete().eq('id', id).eq('user_id', this.userId));
  }

  async getEntry(id: string): Promise<EntryCard | null> {
    const row = check(await this.db.from('entry_cards').select('*').eq('id', id).maybeSingle()) as EntryCardRow | null;
    return row ? entryCardFromRow(row) : null;
  }

  async getUserEntries(userId: string, options: PageOptions = {}): Promise<EntryCard[]> {
    const limit = options.limit ?? 30;
    const offset = options.offset ?? 0;
    let q = this.db.from('entry_cards').select('*').eq('user_id', userId);
    const types = typesFor(options.domain);
    if (types) q = q.in('media_type', [...types]);
    const rows = check(
      await q
        .order('watched_on', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ) as EntryCardRow[];
    return rows.map(entryCardFromRow);
  }

  async getMediaEntries(ref: MediaRef, options: PageOptions = {}): Promise<EntryCard[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const rows = check(
      await this.db
        .from('entry_cards')
        .select('*')
        .eq('media_type', ref.type)
        .eq('media_id', String(ref.id))
        .not('review', 'is', null)
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ) as EntryCardRow[];
    return rows.map(entryCardFromRow);
  }

  async getFeed(options: PageOptions = {}): Promise<EntryCard[]> {
    const rows = check(
      await this.db.rpc('feed', {
        p_before: options.before ?? null,
        p_limit: options.limit ?? 30,
        p_domain: options.domain ?? null,
      }),
    ) as EntryCardRow[];
    return rows.map(entryCardFromRow);
  }

  async getEntriesBetween(userId: string, from: string, to: string): Promise<Entry[]> {
    const rows = await this.fetchAll<EntryRow>((a, b) =>
      this.db
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .gte('watched_on', from)
        .lte('watched_on', to)
        .order('watched_on', { ascending: true })
        .order('created_at', { ascending: true })
        .range(a, b),
    );
    return rows.map(entryFromRow);
  }

  async setEntryLike(entryId: string, like: boolean): Promise<void> {
    if (like) {
      check(
        await this.db
          .from('entry_likes')
          .upsert({ user_id: this.userId, entry_id: entryId }, { onConflict: 'user_id,entry_id', ignoreDuplicates: true }),
      );
    } else {
      check(await this.db.from('entry_likes').delete().eq('user_id', this.userId).eq('entry_id', entryId));
    }
  }

  async getComments(entryId: string): Promise<Comment[]> {
    const rows = check(
      await this.db.from('comment_cards').select('*').eq('entry_id', entryId).order('created_at', { ascending: true }),
    ) as CommentCardRow[];
    return rows.map(commentFromRow);
  }

  async addComment(entryId: string, body: string): Promise<void> {
    check(await this.db.from('comments').insert({ entry_id: entryId, user_id: this.userId, body: body.trim().slice(0, 1000) }));
  }

  async deleteComment(commentId: string): Promise<void> {
    check(await this.db.from('comments').delete().eq('id', commentId));
  }

  /* Community ------------------------------------------------------------ */

  async getTitleStats(ref: MediaRef): Promise<TitleStats> {
    return statsFromJson(check(await this.db.rpc('title_stats', { p_type: ref.type, p_id: String(ref.id) })));
  }

  async getFriendsOn(ref: MediaRef): Promise<FriendRating[]> {
    const rows = check(await this.db.rpc('title_friends', { p_type: ref.type, p_id: String(ref.id) })) as {
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_emoji: string | null;
      rating: number | string | null;
      liked: boolean;
      status: string | null;
    }[];
    return rows.map((r) => ({
      user: liteFromRow({ id: r.user_id, username: r.username, display_name: r.display_name, avatar_emoji: r.avatar_emoji }),
      rating: num(r.rating),
      liked: !!r.liked,
      status: r.status === 'want' || r.status === 'done' ? r.status : null,
    }));
  }

  /* Series --------------------------------------------------------------- */

  async getSeenEpisodes(showId: string): Promise<EpisodeKey[]> {
    const rows = await this.fetchAll<{ season: number; episode: number }>((a, b) =>
      this.db
        .from('episodes_seen')
        .select('season, episode')
        .eq('user_id', this.userId)
        .eq('show_id', showId)
        .order('season')
        .order('episode')
        .range(a, b),
    );
    return rows.map((r) => ({ season: r.season, episode: r.episode }));
  }

  async markEpisodes(show: MediaSnapshot, episodes: EpisodeMark[], seen: boolean): Promise<void> {
    const snap = snapshotColumns(show);
    check(
      await this.db.rpc('mark_episodes', {
        p_show: {
          id: snap.media_id,
          title: snap.title,
          subtitle: snap.subtitle,
          poster: snap.poster,
          year: snap.year,
          genres: snap.genres,
          runtime: snap.runtime,
          creator: snap.creator,
        },
        p_episodes: episodes.map((e) => ({ season: e.season, episode: e.episode, runtime: e.runtime ?? null })),
        p_seen: seen,
      }),
    );
  }

  async getShowsInProgress(): Promise<ShowInProgress[]> {
    const rows = check(await this.db.rpc('shows_in_progress')) as {
      show_id: string;
      title: string;
      subtitle: string | null;
      poster: string | null;
      year: number | null;
      genres: string[] | null;
      runtime: number | null;
      creator: string | null;
      status: string | null;
      seen_count: number;
      last_season: number;
      last_episode: number;
      last_seen_at: string;
    }[];
    return rows.map((r) => ({
      media: snapshotFromRow({ ...r, media_type: 'tv', media_id: r.show_id }),
      status: r.status === 'want' || r.status === 'done' ? r.status : null,
      seenCount: r.seen_count,
      last: { season: r.last_season, episode: r.last_episode },
      lastSeenAt: r.last_seen_at,
    }));
  }

  async getEpisodesSeenBetween(userId: string, fromIso: string, toIso: string): Promise<SeenEpisode[]> {
    const rows = await this.fetchAll<{ show_id: string; season: number; episode: number; runtime: number | null; seen_at: string }>(
      (a, b) =>
        this.db
          .from('episodes_seen')
          .select('show_id, season, episode, runtime, seen_at')
          .eq('user_id', userId)
          .gte('seen_at', fromIso)
          .lte('seen_at', toIso)
          .order('seen_at')
          .range(a, b),
    );
    return rows.map((r) => ({ showId: r.show_id, season: r.season, episode: r.episode, runtime: r.runtime, seenAt: r.seen_at }));
  }

  /* Lists ---------------------------------------------------------------- */

  async getUserLists(userId: string): Promise<ListSummary[]> {
    const rows = check(await this.db.rpc('user_lists', { p_user: userId })) as {
      id: string;
      user_id: string;
      title: string;
      description: string;
      ranked: boolean;
      updated_at: string;
      item_count: number;
      covers: (string | null)[] | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      ranked: r.ranked,
      itemCount: r.item_count,
      covers: r.covers ?? [],
      updatedAt: r.updated_at,
    }));
  }

  async getList(id: string): Promise<ListDetail | null> {
    const list = check(await this.db.from('lists').select('*').eq('id', id).maybeSingle()) as {
      id: string;
      user_id: string;
      title: string;
      description: string;
      ranked: boolean;
      updated_at: string;
    } | null;
    if (!list) return null;
    const [items, authors] = await Promise.all([
      this.db.from('list_items').select('*').eq('list_id', id).order('position').order('added_at').limit(1000),
      this.profilesByIds([list.user_id]),
    ]);
    const rows = check(items) as (LibraryRow & { position: number; note: string | null })[];
    return {
      id: list.id,
      userId: list.user_id,
      title: list.title,
      description: list.description,
      ranked: list.ranked,
      itemCount: rows.length,
      covers: rows.slice(0, 4).map((r) => r.poster),
      updatedAt: list.updated_at,
      author: authors[0] ?? { id: list.user_id, username: '?', displayName: '', avatarEmoji: null },
      items: rows.map((r) => ({ media: snapshotFromRow(r), position: r.position, note: r.note })),
    };
  }

  async saveList(input: ListInput): Promise<string> {
    const row = {
      title: input.title.trim().slice(0, 100),
      description: input.description.trim().slice(0, 1000),
      ranked: input.ranked,
    };
    if (input.id) {
      check(await this.db.from('lists').update(row).eq('id', input.id).eq('user_id', this.userId));
      return input.id;
    }
    const created = check(
      await this.db.from('lists').insert({ ...row, user_id: this.userId }).select('id').single(),
    ) as { id: string };
    return created.id;
  }

  async deleteList(id: string): Promise<void> {
    check(await this.db.from('lists').delete().eq('id', id).eq('user_id', this.userId));
  }

  async listsContaining(ref: MediaRef): Promise<string[]> {
    const mine = check(await this.db.from('lists').select('id').eq('user_id', this.userId)) as { id: string }[];
    if (mine.length === 0) return [];
    const rows = check(
      await this.db
        .from('list_items')
        .select('list_id')
        .eq('media_type', ref.type)
        .eq('media_id', String(ref.id))
        .in('list_id', mine.map((l) => l.id)),
    ) as { list_id: string }[];
    return rows.map((r) => r.list_id);
  }

  async addToList(listId: string, media: MediaSnapshot): Promise<void> {
    const snap = snapshotColumns(media);
    check(
      await this.db.from('list_items').upsert(
        {
          list_id: listId,
          media_type: snap.media_type,
          media_id: snap.media_id,
          title: snap.title,
          subtitle: snap.subtitle,
          poster: snap.poster,
          year: snap.year,
        },
        { onConflict: 'list_id,media_type,media_id', ignoreDuplicates: true },
      ),
    );
  }

  async removeFromList(listId: string, ref: MediaRef): Promise<void> {
    check(
      await this.db
        .from('list_items')
        .delete()
        .eq('list_id', listId)
        .eq('media_type', ref.type)
        .eq('media_id', String(ref.id)),
    );
  }

  async reorderList(listId: string, keys: string[]): Promise<void> {
    check(await this.db.rpc('reorder_list', { p_list: listId, p_keys: keys }));
  }

  /* Match ---------------------------------------------------------------- */

  async createRoom(kind: MatchKind, deck: DeckItem[]): Promise<MatchRoom> {
    return roomFromJson(check(await this.db.rpc('create_match_room', { p_kind: kind, p_deck: deck })));
  }

  async joinRoom(code: string): Promise<MatchRoom> {
    return roomFromJson(check(await this.db.rpc('join_match_room', { p_code: code })));
  }

  async getRoomState(roomId: string): Promise<MatchState | null> {
    const data = check(await this.db.rpc('match_room_state', { p_room: roomId })) as {
      room: unknown;
      members: ProfileRow[];
      swipes: { user_id: string; key: string; liked: boolean }[];
    } | null;
    if (!data || !data.room) return null;
    return {
      room: roomFromJson(data.room),
      members: (data.members ?? []).map(liteFromRow),
      swipes: (data.swipes ?? []).map((s) => ({ userId: s.user_id, key: s.key, liked: s.liked })),
    };
  }

  async swipe(roomId: string, key: string, liked: boolean): Promise<void> {
    check(
      await this.db
        .from('match_swipes')
        .upsert({ room_id: roomId, user_id: this.userId, item_key: key, liked }, { onConflict: 'room_id,user_id,item_key' }),
    );
  }

  async myRooms(): Promise<MatchRoomSummary[]> {
    const rows = check(await this.db.rpc('my_match_rooms')) as {
      id: string;
      code: string;
      kind: MatchKind;
      host_id: string;
      created_at: string;
      member_count: number;
      deck_size: number;
      match_count: number;
    }[];
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      kind: r.kind,
      hostId: r.host_id,
      createdAt: r.created_at,
      memberCount: r.member_count,
      deckSize: r.deck_size,
      matchCount: r.match_count,
    }));
  }

  async leaveRoom(roomId: string): Promise<void> {
    check(await this.db.from('match_members').delete().eq('room_id', roomId).eq('user_id', this.userId));
  }

  /* Account -------------------------------------------------------------- */

  async deleteAccount(): Promise<void> {
    check(await this.db.rpc('delete_my_account'));
  }
}
