import type { Lang } from '@/i18n/lang';
import { inDomain, mediaKey, sameMedia, toSnapshot } from '@/lib/media';
import { hashString, randomId, roomCode } from '@/lib/random';
import { ratingBucket } from '@/lib/rating';
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
  MatchSwipe,
  MediaRef,
  MediaSnapshot,
  Profile,
  ProfileCard,
  ProfileLite,
  ProfilePatch,
  ReportInput,
  SeenEpisode,
  ShowInProgress,
  TastePair,
  TitleStats,
} from '@/lib/types';

import { BOT_ID, type KeyValueStorage, LOCAL_DB_VERSION, type LocalDb, ME_ID } from './localDb';
import { buildSeed } from './seed';
import { type Backend, BackendError, type PageOptions } from './types';

const STORAGE_KEY = 'copione.local.v1';
const BOT_SECONDS_PER_CARD = 2.5;

function lite(p: Profile): ProfileLite {
  return { id: p.id, username: p.username, displayName: p.displayName, avatarEmoji: p.avatarEmoji };
}

function sortEntries(list: Entry[]): Entry[] {
  return list.sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * On-device backend for demo mode: a small JSON "database" persisted to
 * AsyncStorage, pre-filled with a demo community. A bot plays Match with you.
 */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  readonly userId = ME_ID;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private db: LocalDb,
    private readonly storage: KeyValueStorage,
    private readonly lang: Lang,
  ) {}

  static async open(storage: KeyValueStorage, lang: Lang): Promise<LocalBackend> {
    let db: LocalDb | null = null;
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalDb;
        if (parsed.version === LOCAL_DB_VERSION) db = parsed;
      }
    } catch {
      db = null;
    }
    const backend = new LocalBackend(db ?? buildSeed(lang), storage, lang);
    if (!db) await backend.flush();
    return backend;
  }

  /** Wipes local data and restores the demo community. */
  async reset(): Promise<void> {
    this.db = buildSeed(this.lang);
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  private changed() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.flush().catch(() => {});
    }, 150);
  }

  /* Helpers ------------------------------------------------------------ */

  private profile(id: string): Profile | undefined {
    return this.db.profiles.find((p) => p.id === id);
  }

  private hidden(userId: string): boolean {
    return this.db.blocks.some(
      (b) => (b.blockerId === ME_ID && b.blockedId === userId) || (b.blockerId === userId && b.blockedId === ME_ID),
    );
  }

  private card(e: Entry): EntryCard | null {
    const author = this.profile(e.userId);
    if (!author || this.hidden(e.userId)) return null;
    const likes = this.db.likes.filter((l) => l.entryId === e.id);
    return {
      ...e,
      author: lite(author),
      likeCount: likes.length,
      commentCount: this.db.comments.filter((c) => c.entryId === e.id).length,
      likedByMe: likes.some((l) => l.userId === ME_ID),
    };
  }

  private cards(entries: Entry[]): EntryCard[] {
    return entries.map((e) => this.card(e)).filter((c): c is EntryCard => !!c);
  }

  private page<T>(items: T[], options: PageOptions, fallbackLimit: number): T[] {
    const offset = options.offset ?? 0;
    return items.slice(offset, offset + (options.limit ?? fallbackLimit));
  }

  private libraryRow(userId: string, ref: MediaRef): LibraryItem | undefined {
    return this.db.library.find((l) => l.userId === userId && sameMedia(l.media, ref));
  }

  /* Profiles ----------------------------------------------------------- */

  async getProfile(userId: string): Promise<ProfileCard | null> {
    const p = this.profile(userId);
    if (!p) return null;
    const lib = this.db.library.filter((l) => l.userId === userId);
    const yearPrefix = `${new Date().getFullYear()}-`;
    return {
      ...p,
      followers: this.db.follows.filter((f) => f.followeeId === userId).length,
      following: this.db.follows.filter((f) => f.followerId === userId).length,
      isMe: userId === ME_ID,
      isFollowing: this.db.follows.some((f) => f.followerId === ME_ID && f.followeeId === userId),
      followsMe: this.db.follows.some((f) => f.followerId === userId && f.followeeId === ME_ID),
      isBlocked: this.db.blocks.some((b) => b.blockerId === ME_ID && b.blockedId === userId),
      counts: {
        films: lib.filter((l) => l.media.type === 'movie' && l.status === 'done').length,
        shows: lib.filter((l) => l.media.type === 'tv' && l.status === 'done').length,
        albums: lib.filter((l) => l.media.type === 'album' && l.status === 'done').length,
        tracks: lib.filter((l) => l.media.type === 'track' && l.rating != null).length,
        entriesThisYear: this.db.entries.filter((e) => e.userId === userId && e.watchedOn.startsWith(yearPrefix)).length,
      },
    };
  }

  async updateProfile(patch: ProfilePatch): Promise<void> {
    const me = this.profile(ME_ID)!;
    if (patch.username !== undefined) {
      const username = patch.username.toLowerCase();
      if (!(await this.isUsernameAvailable(username)) && username !== me.username) {
        throw new BackendError('username_taken');
      }
      me.username = username;
    }
    if (patch.displayName !== undefined) me.displayName = patch.displayName.slice(0, 40);
    if (patch.bio !== undefined) me.bio = patch.bio.slice(0, 300);
    if (patch.avatarEmoji !== undefined) me.avatarEmoji = patch.avatarEmoji;
    if (patch.favFilms !== undefined) me.favFilms = patch.favFilms.slice(0, 4).map(toSnapshot);
    if (patch.favMusic !== undefined) me.favMusic = patch.favMusic.slice(0, 4).map(toSnapshot);
    if (patch.goalFilms !== undefined) me.goalFilms = patch.goalFilms;
    if (patch.goalAlbums !== undefined) me.goalAlbums = patch.goalAlbums;
    this.changed();
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const u = username.toLowerCase();
    return /^[a-z0-9_]{3,20}$/.test(u) && !this.db.profiles.some((p) => p.username === u);
  }

  async searchProfiles(query: string): Promise<ProfileLite[]> {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    if (!q) return [];
    return this.db.profiles
      .filter((p) => p.id !== BOT_ID && !this.hidden(p.id))
      .filter((p) => p.username.includes(q) || p.displayName.toLowerCase().includes(q))
      .map(lite);
  }

  async suggestedProfiles(): Promise<ProfileLite[]> {
    return this.db.profiles
      .filter(
        (p) =>
          p.id !== ME_ID &&
          p.id !== BOT_ID &&
          !this.hidden(p.id) &&
          !this.db.follows.some((f) => f.followerId === ME_ID && f.followeeId === p.id),
      )
      .map(lite);
  }

  async listFollows(userId: string, kind: 'followers' | 'following'): Promise<ProfileLite[]> {
    const ids =
      kind === 'followers'
        ? this.db.follows.filter((f) => f.followeeId === userId).map((f) => f.followerId)
        : this.db.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
    return ids.map((id) => this.profile(id)).filter((p): p is Profile => !!p).map(lite);
  }

  async setFollow(userId: string, follow: boolean): Promise<void> {
    this.db.follows = this.db.follows.filter((f) => !(f.followerId === ME_ID && f.followeeId === userId));
    if (follow && userId !== ME_ID) {
      this.db.follows.push({ followerId: ME_ID, followeeId: userId, createdAt: new Date().toISOString() });
    }
    this.changed();
  }

  async setBlock(userId: string, block: boolean): Promise<void> {
    this.db.blocks = this.db.blocks.filter((b) => !(b.blockerId === ME_ID && b.blockedId === userId));
    if (block) {
      this.db.blocks.push({ blockerId: ME_ID, blockedId: userId });
      this.db.follows = this.db.follows.filter((f) => !(f.followerId === ME_ID && f.followeeId === userId));
    }
    this.changed();
  }

  async listBlocked(): Promise<ProfileLite[]> {
    return this.db.blocks
      .filter((b) => b.blockerId === ME_ID)
      .map((b) => this.profile(b.blockedId))
      .filter((p): p is Profile => !!p)
      .map(lite);
  }

  async report(input: ReportInput): Promise<void> {
    this.db.reports.push({ ...input, reporterId: ME_ID, createdAt: new Date().toISOString() });
    this.changed();
  }

  /* Library ------------------------------------------------------------ */

  async getLibraryItems(refs: MediaRef[]): Promise<LibraryItem[]> {
    return refs.map((r) => this.libraryRow(ME_ID, r)).filter((l): l is LibraryItem => !!l);
  }

  async setLibrary(media: MediaSnapshot, patch: LibraryPatch): Promise<void> {
    let row = this.libraryRow(ME_ID, media);
    if (!row) {
      row = { userId: ME_ID, media: toSnapshot(media), status: null, rating: null, liked: false, updatedAt: '' };
      this.db.library.push(row);
    } else {
      row.media = toSnapshot(media);
    }
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.rating !== undefined) row.rating = patch.rating;
    if (patch.liked !== undefined) row.liked = patch.liked;
    row.updatedAt = new Date().toISOString();
    this.changed();
  }

  async getUserLibrary(userId: string, filter: LibraryFilter, domain?: Domain): Promise<LibraryItem[]> {
    return this.db.library
      .filter((l) => l.userId === userId && inDomain(l.media.type, domain))
      .filter((l) =>
        filter === 'done'
          ? l.status === 'done'
          : filter === 'want'
            ? l.status === 'want'
            : filter === 'liked'
              ? l.liked
              : l.rating != null,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async tastePairs(otherUserId: string): Promise<TastePair[]> {
    const theirs = new Map(
      this.db.library.filter((l) => l.userId === otherUserId && l.rating != null).map((l) => [mediaKey(l.media), l]),
    );
    return this.db.library
      .filter((l) => l.userId === ME_ID && l.rating != null && theirs.has(mediaKey(l.media)))
      .map((l) => ({ media: l.media, mine: l.rating!, theirs: theirs.get(mediaKey(l.media))!.rating! }));
  }

  /* Diary -------------------------------------------------------------- */

  private entryFromInput(id: string, input: EntryInput, createdAt: string): Entry {
    const review = input.review?.trim() ? input.review.trim().slice(0, 8000) : null;
    return {
      id,
      userId: ME_ID,
      media: toSnapshot(input.media),
      season: input.media.type === 'tv' ? input.season : null,
      watchedOn: input.watchedOn,
      rating: input.rating,
      liked: input.liked,
      rewatch: input.rewatch,
      review,
      spoilers: review ? input.spoilers : false,
      vibes: input.vibes.slice(0, 3),
      createdAt,
    };
  }

  async addEntry(input: EntryInput): Promise<string> {
    const entry = this.entryFromInput(randomId(), input, new Date().toISOString());
    this.db.entries.push(entry);
    this.changed();
    return entry.id;
  }

  async updateEntry(id: string, input: EntryInput): Promise<void> {
    const idx = this.db.entries.findIndex((e) => e.id === id && e.userId === ME_ID);
    if (idx < 0) return;
    this.db.entries[idx] = this.entryFromInput(id, input, this.db.entries[idx].createdAt);
    this.changed();
  }

  async deleteEntry(id: string): Promise<void> {
    if (!this.db.entries.some((e) => e.id === id && e.userId === ME_ID)) return;
    this.db.entries = this.db.entries.filter((e) => e.id !== id);
    this.db.likes = this.db.likes.filter((l) => l.entryId !== id);
    this.db.comments = this.db.comments.filter((c) => c.entryId !== id);
    this.changed();
  }

  async getEntry(id: string): Promise<EntryCard | null> {
    const e = this.db.entries.find((x) => x.id === id);
    return e ? this.card(e) : null;
  }

  async getUserEntries(userId: string, options: PageOptions = {}): Promise<EntryCard[]> {
    const list = sortEntries(this.db.entries.filter((e) => e.userId === userId && inDomain(e.media.type, options.domain)));
    return this.cards(this.page(list, options, 30));
  }

  async getMediaEntries(ref: MediaRef, options: PageOptions = {}): Promise<EntryCard[]> {
    const cards = this.cards(this.db.entries.filter((e) => sameMedia(e.media, ref) && !!e.review)).sort(
      (a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt),
    );
    return this.page(cards, options, 20);
  }

  async getFeed(options: PageOptions = {}): Promise<EntryCard[]> {
    const following = new Set(this.db.follows.filter((f) => f.followerId === ME_ID).map((f) => f.followeeId));
    const list = this.db.entries
      .filter((e) => following.has(e.userId) && inDomain(e.media.type, options.domain))
      .filter((e) => !options.before || e.createdAt < options.before)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.cards(list).slice(0, options.limit ?? 30);
  }

  async getEntriesBetween(userId: string, from: string, to: string): Promise<Entry[]> {
    return this.db.entries
      .filter((e) => e.userId === userId && e.watchedOn >= from && e.watchedOn <= to)
      .sort((a, b) => a.watchedOn.localeCompare(b.watchedOn) || a.createdAt.localeCompare(b.createdAt));
  }

  async setEntryLike(entryId: string, like: boolean): Promise<void> {
    this.db.likes = this.db.likes.filter((l) => !(l.userId === ME_ID && l.entryId === entryId));
    if (like) this.db.likes.push({ userId: ME_ID, entryId, createdAt: new Date().toISOString() });
    this.changed();
  }

  async getComments(entryId: string): Promise<Comment[]> {
    return this.db.comments
      .filter((c) => c.entryId === entryId && !this.hidden(c.userId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => {
        const author = this.profile(c.userId);
        return author ? { id: c.id, entryId: c.entryId, body: c.body, createdAt: c.createdAt, author: lite(author) } : null;
      })
      .filter((c): c is Comment => !!c);
  }

  async addComment(entryId: string, body: string): Promise<void> {
    this.db.comments.push({ id: randomId(), entryId, userId: ME_ID, body: body.trim().slice(0, 1000), createdAt: new Date().toISOString() });
    this.changed();
  }

  async deleteComment(commentId: string): Promise<void> {
    const c = this.db.comments.find((x) => x.id === commentId);
    if (!c) return;
    const entry = this.db.entries.find((e) => e.id === c.entryId);
    if (c.userId !== ME_ID && entry?.userId !== ME_ID) return;
    this.db.comments = this.db.comments.filter((x) => x.id !== commentId);
    this.changed();
  }

  /* Community ---------------------------------------------------------- */

  async getTitleStats(ref: MediaRef): Promise<TitleStats> {
    const lib = this.db.library.filter((l) => sameMedia(l.media, ref));
    const rated = lib.filter((l) => l.rating != null);
    const histogram = new Array<number>(10).fill(0);
    for (const l of rated) histogram[ratingBucket(l.rating!)] += 1;
    const vibeCounts = new Map<string, number>();
    let vibeEntries = 0;
    for (const e of this.db.entries) {
      if (!sameMedia(e.media, ref) || e.vibes.length === 0) continue;
      vibeEntries += 1;
      for (const v of e.vibes) vibeCounts.set(v, (vibeCounts.get(v) ?? 0) + 1);
    }
    const avg = rated.length ? Math.round((rated.reduce((s, l) => s + l.rating!, 0) / rated.length) * 100) / 100 : null;
    return {
      avg,
      count: rated.length,
      histogram,
      done: lib.filter((l) => l.status === 'done').length,
      want: lib.filter((l) => l.status === 'want').length,
      liked: lib.filter((l) => l.liked).length,
      vibes: [...vibeCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([id, count]) => ({ id, count })),
      vibeEntries,
    };
  }

  async getFriendsOn(ref: MediaRef): Promise<FriendRating[]> {
    const following = this.db.follows.filter((f) => f.followerId === ME_ID).map((f) => f.followeeId);
    return following
      .map((id) => ({ user: this.profile(id), row: this.libraryRow(id, ref) }))
      .filter((x): x is { user: Profile; row: LibraryItem } => !!x.user && !!x.row)
      .filter((x) => x.row.rating != null || x.row.liked || x.row.status != null)
      .sort((a, b) => (b.row.rating ?? -1) - (a.row.rating ?? -1))
      .map((x) => ({ user: lite(x.user), rating: x.row.rating, liked: x.row.liked, status: x.row.status }));
  }

  /* Series ------------------------------------------------------------- */

  async getSeenEpisodes(showId: string): Promise<EpisodeKey[]> {
    return this.db.episodes
      .filter((e) => e.userId === ME_ID && e.showId === showId)
      .map((e) => ({ season: e.season, episode: e.episode }))
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
  }

  async markEpisodes(show: MediaSnapshot, episodes: EpisodeMark[], seen: boolean): Promise<void> {
    if (!this.libraryRow(ME_ID, show)) {
      this.db.library.push({
        userId: ME_ID,
        media: toSnapshot(show),
        status: null,
        rating: null,
        liked: false,
        updatedAt: new Date().toISOString(),
      });
    }
    const key = (s: number, e: number) => `${s}:${e}`;
    const targets = new Set(episodes.map((e) => key(e.season, e.episode)));
    if (seen) {
      const existing = new Set(
        this.db.episodes.filter((e) => e.userId === ME_ID && e.showId === show.id).map((e) => key(e.season, e.episode)),
      );
      const now = new Date().toISOString();
      for (const ep of episodes) {
        if (existing.has(key(ep.season, ep.episode))) continue;
        this.db.episodes.push({ userId: ME_ID, showId: show.id, season: ep.season, episode: ep.episode, runtime: ep.runtime ?? null, seenAt: now });
      }
    } else {
      this.db.episodes = this.db.episodes.filter(
        (e) => !(e.userId === ME_ID && e.showId === show.id && targets.has(key(e.season, e.episode))),
      );
    }
    this.changed();
  }

  async getShowsInProgress(): Promise<ShowInProgress[]> {
    const byShow = new Map<string, SeenEpisode[]>();
    for (const e of this.db.episodes) {
      if (e.userId !== ME_ID) continue;
      byShow.set(e.showId, [...(byShow.get(e.showId) ?? []), e]);
    }
    const out: ShowInProgress[] = [];
    for (const [showId, eps] of byShow) {
      const row = this.libraryRow(ME_ID, { type: 'tv', id: showId });
      if (!row) continue;
      const last = eps.reduce((a, b) => (b.season > a.season || (b.season === a.season && b.episode > a.episode) ? b : a));
      out.push({
        media: row.media,
        status: row.status,
        seenCount: eps.length,
        last: { season: last.season, episode: last.episode },
        lastSeenAt: eps.reduce((m, e) => (e.seenAt > m ? e.seenAt : m), ''),
      });
    }
    return out.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async getEpisodesSeenBetween(userId: string, fromIso: string, toIso: string): Promise<SeenEpisode[]> {
    return this.db.episodes
      .filter((e) => e.userId === userId && e.seenAt >= fromIso && e.seenAt <= toIso)
      .map(({ userId: _ignored, ...rest }) => rest);
  }

  /* Lists -------------------------------------------------------------- */

  private summary(list: LocalDb['lists'][number]): ListSummary {
    const items = this.db.listItems.filter((i) => i.listId === list.id).sort((a, b) => a.position - b.position);
    return {
      id: list.id,
      userId: list.userId,
      title: list.title,
      description: list.description,
      ranked: list.ranked,
      itemCount: items.length,
      covers: items.slice(0, 4).map((i) => i.media.poster ?? null),
      updatedAt: list.updatedAt,
    };
  }

  private touchList(listId: string) {
    const list = this.db.lists.find((l) => l.id === listId);
    if (list) list.updatedAt = new Date().toISOString();
  }

  async getUserLists(userId: string): Promise<ListSummary[]> {
    return this.db.lists
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((l) => this.summary(l));
  }

  async getList(id: string): Promise<ListDetail | null> {
    const list = this.db.lists.find((l) => l.id === id);
    const author = list && this.profile(list.userId);
    if (!list || !author) return null;
    return {
      ...this.summary(list),
      author: lite(author),
      items: this.db.listItems
        .filter((i) => i.listId === id)
        .sort((a, b) => a.position - b.position || a.addedAt.localeCompare(b.addedAt))
        .map((i) => ({ media: i.media, position: i.position, note: i.note })),
    };
  }

  async saveList(input: ListInput): Promise<string> {
    const now = new Date().toISOString();
    const fields = { title: input.title.trim().slice(0, 100), description: input.description.trim().slice(0, 1000), ranked: input.ranked };
    if (input.id) {
      const list = this.db.lists.find((l) => l.id === input.id && l.userId === ME_ID);
      if (list) Object.assign(list, fields, { updatedAt: now });
      this.changed();
      return input.id;
    }
    const id = randomId();
    this.db.lists.push({ id, userId: ME_ID, ...fields, createdAt: now, updatedAt: now });
    this.changed();
    return id;
  }

  async deleteList(id: string): Promise<void> {
    if (!this.db.lists.some((l) => l.id === id && l.userId === ME_ID)) return;
    this.db.lists = this.db.lists.filter((l) => l.id !== id);
    this.db.listItems = this.db.listItems.filter((i) => i.listId !== id);
    this.changed();
  }

  async listsContaining(ref: MediaRef): Promise<string[]> {
    const mine = new Set(this.db.lists.filter((l) => l.userId === ME_ID).map((l) => l.id));
    return this.db.listItems.filter((i) => mine.has(i.listId) && sameMedia(i.media, ref)).map((i) => i.listId);
  }

  async addToList(listId: string, media: MediaSnapshot): Promise<void> {
    if (!this.db.lists.some((l) => l.id === listId && l.userId === ME_ID)) return;
    const items = this.db.listItems.filter((i) => i.listId === listId);
    if (items.some((i) => sameMedia(i.media, media))) return;
    const position = items.reduce((m, i) => Math.max(m, i.position), 0) + 1;
    this.db.listItems.push({ listId, media: toSnapshot(media), position, note: null, addedAt: new Date().toISOString() });
    this.touchList(listId);
    this.changed();
  }

  async removeFromList(listId: string, ref: MediaRef): Promise<void> {
    if (!this.db.lists.some((l) => l.id === listId && l.userId === ME_ID)) return;
    this.db.listItems = this.db.listItems.filter((i) => !(i.listId === listId && sameMedia(i.media, ref)));
    this.touchList(listId);
    this.changed();
  }

  async reorderList(listId: string, keys: string[]): Promise<void> {
    if (!this.db.lists.some((l) => l.id === listId && l.userId === ME_ID)) return;
    for (const item of this.db.listItems) {
      if (item.listId !== listId) continue;
      const idx = keys.indexOf(mediaKey(item.media));
      if (idx >= 0) item.position = idx + 1;
    }
    this.changed();
  }

  /* Match -------------------------------------------------------------- */

  /** The demo bot "swipes" one card every few seconds after the room is created. */
  private botSwipes(room: MatchRoom): MatchSwipe[] {
    const elapsed = (Date.now() - new Date(room.createdAt).getTime()) / 1000;
    const visible = Math.min(room.deck.length, Math.floor(elapsed / BOT_SECONDS_PER_CARD) + 2);
    return room.deck.slice(0, visible).map((item) => {
      const score = item.score ?? 7;
      const chance = Math.min(85, Math.max(25, (score - 5.5) * 25));
      return { userId: BOT_ID, key: mediaKey(item), liked: hashString(`${room.id}:${mediaKey(item)}`) % 100 < chance };
    });
  }

  async createRoom(kind: MatchKind, deck: DeckItem[]): Promise<MatchRoom> {
    const room: MatchRoom = {
      id: randomId(),
      code: roomCode(),
      hostId: ME_ID,
      kind,
      deck,
      createdAt: new Date().toISOString(),
    };
    this.db.rooms.push(room);
    const now = room.createdAt;
    this.db.members.push({ roomId: room.id, userId: ME_ID, joinedAt: now }, { roomId: room.id, userId: BOT_ID, joinedAt: now });
    this.changed();
    return room;
  }

  async joinRoom(code: string): Promise<MatchRoom> {
    const room = this.db.rooms.find((r) => r.code === code.toUpperCase().trim());
    if (!room) throw new BackendError('room_not_found');
    if (!this.db.members.some((m) => m.roomId === room.id && m.userId === ME_ID)) {
      this.db.members.push({ roomId: room.id, userId: ME_ID, joinedAt: new Date().toISOString() });
      this.changed();
    }
    return room;
  }

  async getRoomState(roomId: string): Promise<MatchState | null> {
    const room = this.db.rooms.find((r) => r.id === roomId);
    if (!room || !this.db.members.some((m) => m.roomId === roomId && m.userId === ME_ID)) return null;
    const members = this.db.members
      .filter((m) => m.roomId === roomId)
      .map((m) => this.profile(m.userId))
      .filter((p): p is Profile => !!p)
      .map(lite);
    const mine = this.db.swipes.filter((s) => s.roomId === roomId).map((s) => ({ userId: s.userId, key: s.key, liked: s.liked }));
    const bot = members.some((m) => m.id === BOT_ID) ? this.botSwipes(room) : [];
    return { room, members, swipes: [...mine, ...bot] };
  }

  async swipe(roomId: string, key: string, liked: boolean): Promise<void> {
    this.db.swipes = this.db.swipes.filter((s) => !(s.roomId === roomId && s.userId === ME_ID && s.key === key));
    this.db.swipes.push({ roomId, userId: ME_ID, key, liked, createdAt: new Date().toISOString() });
    this.changed();
  }

  async myRooms(): Promise<MatchRoomSummary[]> {
    const mine = this.db.members.filter((m) => m.userId === ME_ID).map((m) => m.roomId);
    const out: MatchRoomSummary[] = [];
    for (const id of mine) {
      const state = await this.getRoomState(id);
      if (!state) continue;
      const memberIds = state.members.map((m) => m.id);
      const likes = new Map<string, Set<string>>();
      for (const s of state.swipes) {
        if (!s.liked) continue;
        likes.set(s.key, (likes.get(s.key) ?? new Set()).add(s.userId));
      }
      const matchCount =
        memberIds.length < 2 ? 0 : state.room.deck.filter((d) => memberIds.every((m) => likes.get(mediaKey(d))?.has(m))).length;
      out.push({
        id,
        code: state.room.code,
        kind: state.room.kind,
        hostId: state.room.hostId,
        createdAt: state.room.createdAt,
        memberCount: memberIds.length,
        deckSize: state.room.deck.length,
        matchCount,
      });
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  }

  async leaveRoom(roomId: string): Promise<void> {
    this.db.members = this.db.members.filter((m) => !(m.roomId === roomId && m.userId === ME_ID));
    this.changed();
  }

  /* Account ------------------------------------------------------------ */

  async deleteAccount(): Promise<void> {
    await this.reset();
  }
}
