import { findMatches } from '@/lib/deck';
import { mediaKey } from '@/lib/media';
import type { DeckItem, EntryInput, MediaSnapshot } from '@/lib/types';

import { LocalBackend } from '../local';
import type { KeyValueStorage } from '../localDb';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

const interstellar: MediaSnapshot = { type: 'movie', id: '157336', title: 'Интерстеллар', year: 2014, runtime: 169 };
const okComputer: MediaSnapshot = { type: 'album', id: 'demo-a1', title: 'OK Computer', subtitle: 'Radiohead' };

const entry = (media: MediaSnapshot, extra: Partial<EntryInput> = {}): EntryInput => ({
  media,
  season: null,
  watchedOn: '2026-05-01',
  rating: 4,
  liked: false,
  rewatch: false,
  review: null,
  spoilers: false,
  vibes: [],
  ...extra,
});

describe('LocalBackend', () => {
  it('seeds a demo community the user already follows', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    const feed = await backend.getFeed();
    expect(feed.length).toBeGreaterThan(10);
    expect(new Set(feed.map((e) => e.author.username))).toEqual(new Set(['kinoman_anya', 'max_scifi', 'lena_vinyl']));
    const music = await backend.getFeed({ domain: 'music' });
    expect(music.every((e) => e.media.type === 'album' || e.media.type === 'track')).toBe(true);
    const suggested = await backend.suggestedProfiles();
    expect(suggested.map((p) => p.username).sort()).toEqual(['dima_noir', 'sasha_anime']);
  });

  it('persists changes between launches', async () => {
    const storage = memoryStorage();
    const first = await LocalBackend.open(storage, 'ru');
    await first.setLibrary(interstellar, { rating: 5, status: 'done' });
    await first.flush();
    const second = await LocalBackend.open(storage, 'en');
    const [item] = await second.getLibraryItems([interstellar]);
    expect(item.rating).toBe(5);
  });

  it('computes community stats and taste match pairs', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    const stats = await backend.getTitleStats(interstellar);
    expect(stats.count).toBe(2);
    expect(stats.avg).toBe(4.75);
    expect(stats.vibes[0].id).toBe('mindblowing');
    await backend.setLibrary(interstellar, { rating: 5 });
    await backend.setLibrary({ type: 'movie', id: '693134', title: 'Dune' }, { rating: 4 });
    const pairs = await backend.tastePairs('demo-anya');
    expect(pairs.map((p) => [p.media.id, p.mine, p.theirs]).sort()).toEqual([
      ['157336', 5, 5],
      ['693134', 4, 4],
    ]);
    const friends = await backend.getFriendsOn(interstellar);
    expect(friends.map((f) => f.user.username)).toEqual(['kinoman_anya', 'max_scifi']);
  });

  it('writes the diary, likes and comments', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    const id = await backend.addEntry(entry(okComputer, { review: '  Шедевр  ', vibes: ['atmospheric'] }));
    const card = await backend.getEntry(id);
    expect(card?.review).toBe('Шедевр');
    expect(card?.author.id).toBe('me');
    await backend.setEntryLike(id, true);
    await backend.addComment(id, 'Согласен');
    expect((await backend.getEntry(id))?.likeCount).toBe(1);
    const [comment] = await backend.getComments(id);
    await backend.deleteComment(comment.id);
    expect(await backend.getComments(id)).toEqual([]);
    const diary = await backend.getUserEntries('me');
    expect(diary.map((e) => e.id)).toEqual([id]);
    await backend.deleteEntry(id);
    expect(await backend.getEntry(id)).toBeNull();
  });

  it('tracks series progress', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    const show: MediaSnapshot = { type: 'tv', id: '95396', title: 'Разделение' };
    await backend.markEpisodes(show, [{ season: 1, episode: 1 }, { season: 1, episode: 2 }], true);
    await backend.markEpisodes(show, [{ season: 1, episode: 2 }], true);
    expect(await backend.getSeenEpisodes('95396')).toHaveLength(2);
    const [progress] = await backend.getShowsInProgress();
    expect(progress.last).toEqual({ season: 1, episode: 2 });
    expect(progress.seenCount).toBe(2);
  });

  it('manages lists', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    const id = await backend.saveList({ title: 'Мой топ', description: '', ranked: true });
    await backend.addToList(id, interstellar);
    await backend.addToList(id, okComputer);
    await backend.reorderList(id, [mediaKey(okComputer), mediaKey(interstellar)]);
    const list = await backend.getList(id);
    expect(list?.items.map((i) => i.media.id)).toEqual(['demo-a1', '157336']);
    expect(await backend.listsContaining(okComputer)).toEqual([id]);
    // Someone else's list cannot be edited.
    await backend.addToList('seed-list-1', okComputer);
    expect((await backend.getList('seed-list-1'))?.items.some((i) => i.media.id === 'demo-a1')).toBe(false);
  });

  it('plays Match with the demo bot', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-01T12:00:00Z') });
    try {
      const backend = await LocalBackend.open(memoryStorage(), 'ru');
      const deck: DeckItem[] = Array.from({ length: 12 }, (_, i) => ({
        type: 'movie',
        id: String(1000 + i),
        title: `Film ${i}`,
        score: 9,
      }));
      const room = await backend.createRoom('movie', deck);
      let state = await backend.getRoomState(room.id);
      expect(state?.members.map((m) => m.id)).toEqual(['me', 'demo-bot']);
      const visibleAtStart = state!.swipes.length;
      jest.setSystemTime(new Date('2026-06-01T12:05:00Z'));
      state = await backend.getRoomState(room.id);
      expect(state!.swipes.length).toBeGreaterThan(visibleAtStart);
      for (const item of deck) await backend.swipe(room.id, mediaKey(item), true);
      state = await backend.getRoomState(room.id);
      const botLikes = state!.swipes.filter((s) => s.userId === 'demo-bot' && s.liked).length;
      expect(findMatches(state!)).toHaveLength(botLikes);
      expect(botLikes).toBeGreaterThan(0);
      const [summary] = await backend.myRooms();
      expect(summary.matchCount).toBe(botLikes);
      await expect(backend.joinRoom('NOPE1')).rejects.toMatchObject({ code: 'room_not_found' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides blocked people and resets the demo', async () => {
    const backend = await LocalBackend.open(memoryStorage(), 'ru');
    await backend.setBlock('demo-max', true);
    const feed = await backend.getFeed();
    expect(feed.some((e) => e.author.id === 'demo-max')).toBe(false);
    expect((await backend.getProfile('demo-max'))?.isBlocked).toBe(true);
    await backend.deleteAccount();
    expect((await backend.getFeed()).some((e) => e.author.id === 'demo-max')).toBe(true);
  });
});
