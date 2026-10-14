import { albumKindFromName, cleanAlbumName } from '@/catalog/itunes';
import { en } from '@/i18n/en';
import { pluralForm } from '@/i18n/extra';
import { translate } from '@/i18n';
import { ru } from '@/i18n/ru';

import { addDays, isValidISODate } from '../dates';
import { buildDeck, findMatches, nextCardIndex } from '../deck';
import { mediaKey, parseMediaKey, toSnapshot } from '../media';
import { normalizeRating, starsText, suggestedAlbumRating } from '../rating';
import { looksLikeSoundtrack, mentionsTitle, normalizeTitle, truncate } from '../text';
import type { MatchState, MediaSummary } from '../types';
import { sanitizeVibes, vibePercent } from '../vibes';

describe('ratings', () => {
  it('rounds to half stars', () => {
    expect(normalizeRating(4.3)).toBe(4.5);
    expect(normalizeRating(0.1)).toBeNull();
    expect(normalizeRating(9)).toBe(5);
    expect(starsText(3.5)).toBe('★★★½');
    expect(suggestedAlbumRating([5, 4, null, 4])).toBe(4.5);
    expect(suggestedAlbumRating([null])).toBeNull();
  });
});

describe('dates', () => {
  it('adds days across months and validates', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
  });
});

describe('media keys', () => {
  it('round-trips keys and strips catalog fields', () => {
    expect(parseMediaKey(mediaKey({ type: 'album', id: '123' }))).toEqual({ type: 'album', id: '123' });
    expect(parseMediaKey('person:1')).toBeNull();
    const snap = toSnapshot({ type: 'movie', id: '1', title: 'X', overview: 'long', score: 8, runtime: 100.4 });
    expect(snap).toEqual({
      type: 'movie',
      id: '1',
      title: 'X',
      subtitle: null,
      poster: null,
      year: null,
      genres: [],
      runtime: 100,
      creator: null,
    });
  });
});

describe('text helpers', () => {
  it('normalizes titles', () => {
    expect(normalizeTitle('Amélie — Le Fabuleux!')).toBe('amelie le fabuleux');
    expect(normalizeTitle('Ёлки')).toBe('елки');
  });

  it('recognizes soundtracks of a film', () => {
    const album = 'Interstellar (Original Motion Picture Soundtrack)';
    expect(looksLikeSoundtrack(album)).toBe(true);
    expect(mentionsTitle(album, 'Interstellar')).toBe(true);
    expect(mentionsTitle(album, 'Inter')).toBe(false);
    expect(looksLikeSoundtrack('OK Computer')).toBe(false);
  });

  it('truncates on word boundaries', () => {
    expect(truncate('one two three four', 10)).toBe('one two…');
  });
});

describe('itunes helpers', () => {
  it('derives the release type from Apple naming', () => {
    expect(albumKindFromName('Blinding Lights - Single')).toBe('single');
    expect(albumKindFromName("don't smile at me - EP")).toBe('ep');
    expect(albumKindFromName('Now 100', 'Various Artists')).toBe('compilation');
    expect(albumKindFromName('AM')).toBe('album');
    expect(cleanAlbumName('Blinding Lights - Single')).toBe('Blinding Lights');
  });
});

describe('vibes', () => {
  it('keeps up to three known vibes of the right domain', () => {
    expect(sanitizeVibes(['funny', 'banger', 'funny', 'cozy', 'scary', 'twist', 'nope'], 'film')).toEqual([
      'funny',
      'cozy',
      'scary',
    ]);
    expect(vibePercent(3, 4)).toBe(75);
    expect(vibePercent(1, 0)).toBe(0);
  });
});

describe('match deck', () => {
  const item = (id: string): MediaSummary => ({ type: 'movie', id, title: `Film ${id}` });

  it('builds a deterministic, de-duplicated deck', () => {
    const sources = [[item('1'), item('2'), item('3')], [item('2'), item('4')]];
    const a = buildDeck(sources, { seed: 'room', exclude: new Set(['movie:3']) });
    const b = buildDeck(sources, { seed: 'room', exclude: new Set(['movie:3']) });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id).sort()).toEqual(['1', '2', '4']);
  });

  it('finds titles liked by every member', () => {
    const state: MatchState = {
      room: { id: 'r', code: 'ABCDE', hostId: 'u1', kind: 'movie', deck: [item('1'), item('2')], createdAt: '' },
      members: [
        { id: 'u1', username: 'a', displayName: '', avatarEmoji: null },
        { id: 'u2', username: 'b', displayName: '', avatarEmoji: null },
      ],
      swipes: [
        { userId: 'u1', key: 'movie:1', liked: true },
        { userId: 'u2', key: 'movie:1', liked: true },
        { userId: 'u1', key: 'movie:2', liked: true },
        { userId: 'u2', key: 'movie:2', liked: false },
      ],
    };
    expect(findMatches(state).map((x) => x.id)).toEqual(['1']);
    expect(nextCardIndex(state, 'u1')).toBe(2);
    expect(nextCardIndex({ ...state, swipes: [] }, 'u1')).toBe(0);
    expect(findMatches({ ...state, members: state.members.slice(0, 1) })).toEqual([]);
  });
});

describe('i18n', () => {
  it('uses Russian plural rules', () => {
    const forms = [1, 2, 5, 11, 21, 22, 25, 111, 112].map((n) => pluralForm('ru', 'films', n));
    expect(forms).toEqual(['фильм', 'фильма', 'фильмов', 'фильмов', 'фильм', 'фильма', 'фильмов', 'фильмов', 'фильмов']);
    expect(pluralForm('en', 'films', 1)).toBe('movie');
    expect(pluralForm('en', 'films', 2)).toBe('movies');
  });

  it('interpolates parameters', () => {
    expect(translate('ru', 'taste.common', { n: 7 })).toBe('Общих оценок: 7');
    expect(translate('en', 'match.inviteText', { app: 'Copione', code: 'K7MPX' })).toContain('K7MPX');
  });

  it('has an English string for every key', () => {
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(typeof en[key]).toBe('string');
      expect(en[key].length).toBeGreaterThan(0);
    }
  });
});
