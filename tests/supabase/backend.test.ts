/**
 * Integration test: runs SupabaseBackend (the real app code) against a local
 * Supabase stack (Postgres + GoTrue + PostgREST) with supabase/schema.sql applied.
 *
 *   tests/supabase/stack.sh up && tests/supabase/stack.sh schema
 *   node tests/supabase/gateway.mjs &
 *   npm run test:supabase
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabaseBackend } from '../../src/backend/supabase';
import { findMatches } from '../../src/lib/deck';
import { mediaKey } from '../../src/lib/media';
import type { DeckItem, EntryInput, MediaSnapshot } from '../../src/lib/types';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.ANON_KEY;
if (!ANON_KEY) throw new Error('Set ANON_KEY (see tests/supabase/keys.mjs)');

const run = Date.now().toString(36);

async function signUp(name: string): Promise<{ client: SupabaseClient; backend: SupabaseBackend }> {
  const client = createClient(URL, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({
    email: `${name}-${run}@example.com`,
    password: 'secret-password',
    options: { data: { username: `${name}_${run}`.slice(0, 20), display_name: name } },
  });
  assert.equal(error, null, error?.message);
  assert.ok(data.session, 'GoTrue should auto-confirm in the test stack');
  return { client, backend: new SupabaseBackend(client, data.user!.id) };
}

const dune: MediaSnapshot = {
  type: 'movie',
  id: '693134',
  title: 'Дюна: Часть вторая',
  subtitle: 'Dune: Part Two',
  poster: '/abc.jpg',
  year: 2024,
  genres: ['878', '12'],
  runtime: 167,
  creator: 'Denis Villeneuve',
};
const matrix: MediaSnapshot = { type: 'movie', id: '603', title: 'Матрица', year: 1999, genres: ['28'] };
const okComputer: MediaSnapshot = {
  type: 'album',
  id: '1097861387',
  title: 'OK Computer',
  subtitle: 'Radiohead',
  poster: 'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg',
  year: 1997,
  genres: ['Alternative'],
  runtime: 53,
  creator: 'Radiohead',
};
const severance: MediaSnapshot = { type: 'tv', id: '95396', title: 'Разделение', year: 2022, runtime: 55 };

function entry(media: MediaSnapshot, extra: Partial<EntryInput> = {}): EntryInput {
  return {
    media,
    season: null,
    watchedOn: '2026-03-01',
    rating: 4.5,
    liked: true,
    rewatch: false,
    review: null,
    spoilers: false,
    vibes: [],
    ...extra,
  };
}

describe('SupabaseBackend against a local Supabase', () => {
  let anya: SupabaseBackend;
  let max: SupabaseBackend;
  let anyaEntryId = '';

  before(async () => {
    anya = (await signUp('anya')).backend;
    max = (await signUp('max')).backend;
  });

  after(async () => {
    await anya?.deleteAccount().catch(() => {});
  });

  it('creates a profile on sign-up and updates it', async () => {
    const card = await anya.getProfile(anya.userId);
    assert.ok(card);
    assert.equal(card.username, `anya_${run}`.slice(0, 20));
    assert.equal(card.displayName, 'anya');
    assert.equal(card.isMe, true);
    await anya.updateProfile({ displayName: 'Аня', bio: 'Люблю Нолана', favFilms: [dune], avatarEmoji: '🎬', goalFilms: 50 });
    const updated = await anya.getProfile(anya.userId);
    assert.equal(updated?.displayName, 'Аня');
    assert.equal(updated?.favFilms[0].title, dune.title);
    assert.equal(updated?.goalFilms, 50);
    assert.equal(await anya.isUsernameAvailable(card.username), false);
    assert.equal(await anya.isUsernameAvailable(`free_${run}`.slice(0, 20)), true);
  });

  it('rejects a username that is taken', async () => {
    const maxCard = await max.getProfile(max.userId);
    await assert.rejects(anya.updateProfile({ username: maxCard!.username }), (err: { code?: string }) => err.code === 'username_taken');
  });

  it('stores ratings, likes and the watchlist', async () => {
    await anya.setLibrary(dune, { rating: 4.5, status: 'done' });
    await anya.setLibrary(dune, { liked: true });
    await anya.setLibrary(matrix, { status: 'want' });
    const items = await anya.getLibraryItems([dune, matrix, okComputer]);
    const d = items.find((i) => i.media.id === dune.id)!;
    assert.equal(d.rating, 4.5);
    assert.equal(d.liked, true);
    assert.equal(d.status, 'done');
    assert.equal(d.media.creator, 'Denis Villeneuve');
    assert.deepEqual(d.media.genres, ['878', '12']);
    assert.equal(items.find((i) => i.media.id === matrix.id)?.status, 'want');
    const want = await anya.getUserLibrary(anya.userId, 'want', 'film');
    assert.deepEqual(want.map((i) => i.media.id), [matrix.id]);
    const rated = await anya.getUserLibrary(anya.userId, 'rated');
    assert.deepEqual(rated.map((i) => i.media.id), [dune.id]);
  });

  it('writes diary entries with reviews and vibes', async () => {
    anyaEntryId = await anya.addEntry(
      entry(dune, { review: '  Песок, звук и Циммер.  ', vibes: ['visual', 'score'], spoilers: true }),
    );
    await anya.addEntry(entry(okComputer, { rating: 5, vibes: ['atmospheric'] }));
    const card = await anya.getEntry(anyaEntryId);
    assert.ok(card);
    assert.equal(card.review, 'Песок, звук и Циммер.');
    assert.equal(card.spoilers, true);
    assert.deepEqual(card.vibes, ['visual', 'score']);
    assert.equal(card.author.displayName, 'Аня');
    assert.equal(card.rating, 4.5);
    const diary = await anya.getUserEntries(anya.userId, { domain: 'music' });
    assert.deepEqual(diary.map((e) => e.media.id), [okComputer.id]);
    const reviews = await anya.getMediaEntries(dune);
    assert.deepEqual(reviews.map((e) => e.id), [anyaEntryId]);
    const between = await anya.getEntriesBetween(anya.userId, '2026-01-01', '2026-12-31');
    assert.equal(between.length, 2);
  });

  it('builds the feed from people you follow, with likes and comments', async () => {
    assert.deepEqual(await max.getFeed(), []);
    await max.setFollow(anya.userId, true);
    await max.setFollow(anya.userId, true); // idempotent
    const feed = await max.getFeed();
    assert.equal(feed.length, 2);
    assert.deepEqual((await max.getFeed({ domain: 'film' })).map((e) => e.id), [anyaEntryId]);

    await max.setEntryLike(anyaEntryId, true);
    await max.addComment(anyaEntryId, 'Согласен, Циммер — гений');
    const seenByMax = await max.getEntry(anyaEntryId);
    assert.equal(seenByMax?.likeCount, 1);
    assert.equal(seenByMax?.likedByMe, true);
    assert.equal(seenByMax?.commentCount, 1);
    const comments = await anya.getComments(anyaEntryId);
    assert.equal(comments[0].body, 'Согласен, Циммер — гений');
    // The entry author may delete comments on their entry.
    await anya.deleteComment(comments[0].id);
    assert.deepEqual(await max.getComments(anyaEntryId), []);

    const followers = await anya.listFollows(anya.userId, 'followers');
    assert.deepEqual(followers.map((p) => p.id), [max.userId]);
    const card = await max.getProfile(anya.userId);
    assert.equal(card?.isFollowing, true);
    assert.equal(card?.followers, 1);
    assert.equal(card?.counts.films, 1);
  });

  it('computes community stats, friends and taste pairs', async () => {
    await max.setLibrary(dune, { rating: 3, status: 'done' });
    await max.addEntry(entry(dune, { rating: 3, vibes: ['visual'] }));
    const stats = await max.getTitleStats(dune);
    assert.equal(stats.count, 2);
    assert.equal(stats.avg, 3.75);
    assert.equal(stats.histogram[5], 1); // 3★
    assert.equal(stats.histogram[8], 1); // 4.5★
    assert.equal(stats.vibes[0].id, 'visual');
    assert.equal(stats.vibes[0].count, 2);
    assert.equal(stats.vibeEntries, 2);

    const friends = await max.getFriendsOn(dune);
    assert.equal(friends[0].user.id, anya.userId);
    assert.equal(friends[0].rating, 4.5);

    const pairs = await anya.tastePairs(max.userId);
    assert.deepEqual(pairs.map((p) => [p.media.id, p.mine, p.theirs]), [[dune.id, 4.5, 3]]);
  });

  it('tracks series progress', async () => {
    await anya.markEpisodes(severance, [
      { season: 1, episode: 1, runtime: 57 },
      { season: 1, episode: 2, runtime: 53 },
      { season: 1, episode: 3, runtime: null },
    ], true);
    await anya.markEpisodes(severance, [{ season: 1, episode: 3 }], false);
    assert.deepEqual(await anya.getSeenEpisodes(severance.id), [
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]);
    const shows = await anya.getShowsInProgress();
    assert.equal(shows[0].media.id, severance.id);
    assert.equal(shows[0].seenCount, 2);
    assert.deepEqual(shows[0].last, { season: 1, episode: 2 });
    const eps = await anya.getEpisodesSeenBetween(anya.userId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
    assert.equal(eps.length, 2);
    assert.equal(eps.find((e) => e.episode === 1)?.runtime, 57);
  });

  it('manages lists', async () => {
    const id = await anya.saveList({ title: 'Космос', description: 'Про звёзды', ranked: true });
    await anya.addToList(id, dune);
    await anya.addToList(id, okComputer);
    await anya.addToList(id, dune); // duplicate is ignored
    assert.deepEqual(await anya.listsContaining(dune), [id]);
    await anya.reorderList(id, [mediaKey(okComputer), mediaKey(dune)]);
    const list = await max.getList(id);
    assert.equal(list?.author.id, anya.userId);
    assert.deepEqual(list?.items.map((i) => i.media.id), [okComputer.id, dune.id]);
    const lists = await max.getUserLists(anya.userId);
    assert.equal(lists[0].itemCount, 2);
    assert.equal(lists[0].covers.length, 2);
    // Max cannot edit Anya's list.
    await max.addToList(id, matrix).catch(() => {});
    assert.equal((await anya.getList(id))?.items.length, 2);
    await anya.removeFromList(id, dune);
    assert.equal((await anya.getList(id))?.items.length, 1);
    await anya.saveList({ id, title: 'Космос и музыка', description: '', ranked: false });
    assert.equal((await anya.getList(id))?.title, 'Космос и музыка');
    await anya.deleteList(id);
    assert.equal(await anya.getList(id), null);
  });

  it('plays a Match room', async () => {
    const deck: DeckItem[] = [dune, matrix, okComputer].map((m) => ({ ...m, overview: 'x', score: 8 }));
    const room = await anya.createRoom('mixed', deck);
    assert.match(room.code, /^[A-Z0-9]{5}$/);
    assert.equal(room.deck.length, 3);
    await assert.rejects(max.joinRoom('ZZZZZ'), (err: { code?: string }) => err.code === 'room_not_found');
    assert.equal(await max.getRoomState(room.id), null); // not a member yet
    const joined = await max.joinRoom(room.code.toLowerCase());
    assert.equal(joined.id, room.id);
    await anya.swipe(room.id, mediaKey(dune), true);
    await anya.swipe(room.id, mediaKey(matrix), true);
    await max.swipe(room.id, mediaKey(dune), true);
    await max.swipe(room.id, mediaKey(matrix), false);
    await max.swipe(room.id, mediaKey(matrix), false); // re-swipe is an upsert
    const state = await anya.getRoomState(room.id);
    assert.equal(state?.members.length, 2);
    assert.deepEqual(findMatches(state!).map((d) => d.id), [dune.id]);
    const rooms = await max.myRooms();
    assert.equal(rooms[0].matchCount, 1);
    assert.equal(rooms[0].memberCount, 2);
    await max.leaveRoom(room.id);
    assert.equal(await max.getRoomState(room.id), null);
  });

  it('enforces row level security', async () => {
    const maxEntry = (await max.getUserEntries(max.userId))[0];
    // Anya's backend targets her own rows only, so try the raw client path:
    await anya.updateEntry(maxEntry.id, entry(dune, { review: 'hacked' }));
    assert.equal((await max.getEntry(maxEntry.id))?.review, null);
    await anya.deleteEntry(maxEntry.id);
    assert.ok(await max.getEntry(maxEntry.id));
  });

  it('hides blocked users both ways and accepts reports', async () => {
    await max.report({ targetType: 'entry', targetId: anyaEntryId, reason: 'test' });
    await anya.setBlock(max.userId, true);
    assert.deepEqual((await anya.listBlocked()).map((p) => p.id), [max.userId]);
    assert.equal((await anya.getMediaEntries(dune)).some((e) => e.author.id === max.userId), false);
    assert.equal(await max.getEntry(anyaEntryId), null);
    assert.equal((await max.searchProfiles(`anya_${run}`)).length, 0);
    await anya.setBlock(max.userId, false);
    assert.ok(await max.getEntry(anyaEntryId));
    assert.equal((await max.searchProfiles(`anya_${run}`)).length, 1);
  });

  it('deletes an account with all its data', async () => {
    const maxId = max.userId;
    await max.deleteAccount();
    assert.equal(await anya.getProfile(maxId), null);
    assert.equal((await anya.getTitleStats(dune)).count, 1);
  });
});
