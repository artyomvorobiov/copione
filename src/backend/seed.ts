import { demoSnapshot } from '@/catalog/demo';
import type { Lang } from '@/i18n/lang';
import { toISODate } from '@/lib/dates';
import { mediaKey, parseMediaKey, toSnapshot } from '@/lib/media';
import type { Entry, LibraryItem, MediaSnapshot, Profile } from '@/lib/types';

import { BOT_ID, LOCAL_DB_VERSION, type LocalDb, ME_ID } from './localDb';

/**
 * The demo community: a handful of people with ratings, reviews, lists and
 * comments about the bundled demo titles. Used only in local (demo) mode.
 */
type L = { ru: string; en: string };
const R = (ru: string, en: string): L => ({ ru, en });

interface SeedUser {
  key: string;
  id: string;
  username: string;
  name: L;
  emoji: string;
  bio: L;
  favFilms: string[];
  favMusic: string[];
}

const USERS: SeedUser[] = [
  {
    key: 'anya',
    id: 'demo-anya',
    username: 'kinoman_anya',
    name: R('Аня', 'Anya'),
    emoji: '🎬',
    bio: R('Смотрю всё, что снимает Нолан, и плачу на мультфильмах Pixar.', 'I watch everything Nolan makes and cry at Pixar movies.'),
    favFilms: ['movie:157336', 'movie:14160', 'movie:666277', 'tv:87108'],
    favMusic: ['album:demo-a12', 'album:demo-a9'],
  },
  {
    key: 'max',
    id: 'demo-max',
    username: 'max_scifi',
    name: R('Макс', 'Max'),
    emoji: '🚀',
    bio: R('Фантастика, синтвейв и длинные альбомы.', 'Sci-fi, synthwave and long albums.'),
    favFilms: ['movie:603', 'movie:335984', 'movie:157336', 'movie:27205'],
    favMusic: ['album:demo-a2', 'album:demo-a1'],
  },
  {
    key: 'lena',
    id: 'demo-lena',
    username: 'lena_vinyl',
    name: R('Лена', 'Lena'),
    emoji: '🎧',
    bio: R('Пластинки, инди и уютное кино по воскресеньям.', 'Vinyl, indie and cozy Sunday movies.'),
    favFilms: ['movie:194', 'movie:313369', 'movie:120467'],
    favMusic: ['album:demo-a13', 'album:demo-a8', 'album:demo-a7'],
  },
  {
    key: 'dima',
    id: 'demo-dima',
    username: 'dima_noir',
    name: R('Дима', 'Dima'),
    emoji: '🕵️',
    bio: R('Триллеры, нуар и русский рок.', 'Thrillers, noir and Russian rock.'),
    favFilms: ['movie:680', 'movie:496243', 'movie:155', 'tv:1396'],
    favMusic: ['album:demo-a6', 'album:demo-a5', 'album:demo-a3'],
  },
  {
    key: 'sasha',
    id: 'demo-sasha',
    username: 'sasha_anime',
    name: R('Саша', 'Sasha'),
    emoji: '🐉',
    bio: R('Миядзаки, «Аркейн» и саундтреки.', 'Miyazaki, Arcane and soundtracks.'),
    favFilms: ['movie:129', 'tv:94605', 'movie:545611'],
    favMusic: ['album:demo-a9', 'album:demo-a4'],
  },
];

type SeedEntry = [
  user: string,
  media: string,
  rating: number | null,
  liked: boolean,
  vibes: string[],
  daysAgo: number,
  review?: L,
  extra?: { season?: number; spoilers?: boolean },
];

const ENTRIES: SeedEntry[] = [
  ['anya', 'movie:157336', 5, true, ['mindblowing', 'tearjerker', 'score'], 2, R('Третий раз — и опять реву на сцене с видеосообщениями. Циммер с органом — отдельный вид искусства.', 'Third time watching and I still cry at the video messages scene. Zimmer on the organ is its own art form.')],
  ['anya', 'movie:14160', 4.5, true, ['tearjerker', 'cozy'], 9, R('Первые десять минут — лучший короткометражный фильм о любви. Дальше просто очень хороший мультфильм.', 'The first ten minutes are the best short film about love ever made. The rest is just a very good cartoon.')],
  ['anya', 'movie:666277', 4.5, false, ['thoughtful', 'tearjerker'], 16, R('Тихий фильм, который звучит в голове ещё неделю. Ин-ён.', 'A quiet film that keeps echoing for a week. In-yun.')],
  ['anya', 'movie:346698', 3.5, false, ['funny', 'visual'], 24, R('Кен вытащил весь фильм. I’m just Ken!', 'Ken carried the whole movie. I’m just Ken!')],
  ['anya', 'movie:693134', 4, false, ['visual'], 30],
  ['anya', 'movie:872585', 4, false, ['gripping'], 38, R('Три часа пролетели незаметно. Звук на сцене испытания — мурашки.', 'Three hours flew by. The sound during the test scene — goosebumps.')],
  ['anya', 'tv:87108', 5, true, ['gripping', 'thoughtful'], 45, R('«Какова цена лжи?» Лучший мини-сериал, который я видела.', '“What is the cost of lies?” The best miniseries I have seen.')],
  ['anya', 'album:demo-a12', 4.5, true, ['chill', 'lyrics'], 5, R('Осенний альбом, который хорошо слушать в любое время года. «august» на репите.', 'An autumn album that works in any season. “august” on repeat.')],
  ['anya', 'album:demo-a9', 5, false, ['atmospheric'], 3],
  ['anya', 'movie:313369', 4, false, [], 60],

  ['max', 'movie:335984', 5, true, ['visual', 'thoughtful', 'score'], 1, R('Каждый кадр можно повесить на стену. Медленно, гипнотически, идеально.', 'Every frame belongs on a wall. Slow, hypnotic, perfect.')],
  ['max', 'movie:157336', 4.5, false, ['mindblowing'], 12],
  ['max', 'movie:27205', 4.5, false, ['mindblowing', 'twist'], 20, R('Волчок до сих пор крутится.', 'The top is still spinning.')],
  ['max', 'movie:603', 5, true, ['mindblowing'], 33, R('Фильм, после которого я пошёл учиться на программиста.', 'The film that made me become a programmer.')],
  ['max', 'movie:693134', 4.5, false, ['visual', 'score'], 28],
  ['max', 'movie:76341', 4, false, ['gripping'], 50],
  ['max', 'movie:1398', 4, false, ['thoughtful', 'slow'], 70, R('Медитация на три часа. Не для всех, но после неё мир выглядит иначе.', 'A three-hour meditation. Not for everyone, but the world looks different afterwards.')],
  ['max', 'tv:95396', 5, true, ['mindblowing', 'twist'], 4, R('Финал второго сезона: Марк выбирает Хелли и бежит обратно в «Люмон» — я кричал.', 'Season 2 finale: Mark chooses Helly and runs back into Lumon — I screamed.'), { season: 2, spoilers: true }],
  ['max', 'album:demo-a2', 5, true, ['production', 'dance'], 7, R('Записан с живыми музыкантами и звучит как машина времени. «Giorgio by Moroder» — и лекция, и танцпол одновременно.', 'Recorded with live musicians, it sounds like a time machine. “Giorgio by Moroder” is a lecture and a dance floor at once.')],
  ['max', 'album:demo-a1', 4.5, false, ['atmospheric'], 14],
  ['max', 'movie:545611', 3, false, ['funny'], 40, R('Идея гениальная, но к концу я устал от хаоса.', 'Brilliant idea, but I got tired of the chaos by the end.')],

  ['lena', 'movie:194', 5, true, ['cozy', 'visual'], 3, R('Мой фильм для плохого настроения. Работает безотказно.', 'My bad-mood movie. Works every time.')],
  ['lena', 'movie:120467', 4.5, true, ['funny', 'visual'], 11, R('Уэс Андерсон в лучшей форме: симметрия, пастель и Рэйф Файнс.', 'Peak Wes Anderson: symmetry, pastels and Ralph Fiennes.')],
  ['lena', 'movie:313369', 5, true, ['tearjerker', 'score'], 19, R('Эпилог разбил мне сердце, а я всё равно пересматриваю.', 'The epilogue broke my heart and I keep rewatching it.')],
  ['lena', 'movie:152601', 4, false, ['thoughtful'], 27],
  ['lena', 'movie:666277', 4, false, [], 35],
  ['lena', 'movie:346698', 4, false, ['funny'], 22],
  ['lena', 'album:demo-a13', 5, true, ['nostalgic', 'roadtrip'], 2, R('Альбом о том, как все ссорятся, а звучит так, будто все влюблены.', 'An album about everyone fighting that sounds like everyone is in love.')],
  ['lena', 'album:demo-a8', 5, false, ['night', 'atmospheric'], 8, R('«White Ferrari» в три часа ночи — опыт, который трудно описать словами.', '“White Ferrari” at 3am is an experience that is hard to put into words.')],
  ['lena', 'album:demo-a7', 4, false, ['night'], 18],
  ['lena', 'movie:244786', 3.5, false, ['gripping'], 44, R('Блестяще снято, но смотреть было физически тяжело.', 'Brilliantly made, but physically hard to watch.')],
  ['lena', 'tv:136315', 4.5, true, ['gripping'], 6],

  ['dima', 'movie:680', 5, true, ['funny', 'gripping'], 5, R('Диалоги, которые я знаю наизусть. Royale with cheese.', 'Dialogue I know by heart. Royale with cheese.')],
  ['dima', 'movie:155', 5, false, ['gripping'], 13, R('Леджер — лучший злодей в истории кино. Точка.', 'Ledger is the best villain in film history. Period.')],
  ['dima', 'movie:496243', 5, true, ['twist', 'thoughtful'], 21, R('Начинается как комедия, заканчивается как пощёчина.', 'Starts like a comedy, ends like a slap in the face.')],
  ['dima', 'movie:25237', 5, false, ['thoughtful'], 55, R('Самый тяжёлый фильм в моей жизни. Важно посмотреть хотя бы раз.', 'The hardest film I have ever watched. Essential to see at least once.')],
  ['dima', 'tv:1396', 5, true, ['gripping'], 26, R('Say my name. Идеальная арка персонажа.', 'Say my name. A perfect character arc.')],
  ['dima', 'tv:70523', 4.5, false, ['mindblowing', 'twist'], 48],
  ['dima', 'movie:1124', 4.5, false, ['twist'], 36],
  ['dima', 'album:demo-a6', 5, true, ['nostalgic', 'lyrics'], 4, R('Эту пластинку в нашем дворе знали наизусть. Звучит актуально до сих пор.', 'Our whole neighbourhood knew this record by heart. Still sounds relevant.')],
  ['dima', 'album:demo-a5', 5, false, ['atmospheric', 'production'], 15],
  ['dima', 'album:demo-a3', 4.5, false, ['lyrics'], 31],
  ['dima', 'movie:346698', 2, false, ['overrated'], 23, R('Не моё. Розового слишком много.', 'Not for me. Way too much pink.')],

  ['sasha', 'movie:129', 5, true, ['cozy', 'visual'], 6, R('Каждый раз нахожу новую деталь на заднем плане. Магия.', 'I find a new background detail every time. Pure magic.')],
  ['sasha', 'tv:94605', 5, true, ['visual', 'score', 'tearjerker'], 10, R('Анимация, музыка, драма — второй сезон достойно закрыл историю.', 'Animation, music, drama — season two closed the story with dignity.'), { season: 2 }],
  ['sasha', 'movie:14160', 4.5, false, ['tearjerker'], 29],
  ['sasha', 'album:demo-a9', 5, true, ['atmospheric'], 1, R('«Cornfield Chase» — трек, под который хочется лететь куда угодно.', '“Cornfield Chase” makes you want to fly anywhere.')],
  ['sasha', 'album:demo-a4', 4, false, ['night', 'production'], 17],
  ['sasha', 'track:demo-a4-2', 4.5, false, ['banger'], 17],
  ['sasha', 'track:demo-a11-1', 4, false, ['dance'], 9],
  ['sasha', 'movie:545611', 5, true, ['mindblowing', 'tearjerker', 'funny'], 34, R('Бейгл со всем внутри и Мишель Йео — шедевр о семье.', 'An everything bagel and Michelle Yeoh — a masterpiece about family.')],
  ['sasha', 'tv:66732', 4, false, [], 42],
  ['sasha', 'movie:27205', 4, false, [], 58],
];

const WATCHLIST: [string, string][] = [
  ['anya', 'movie:1398'],
  ['anya', 'movie:496243'],
  ['max', 'tv:1396'],
  ['lena', 'album:demo-a1'],
  ['dima', 'tv:95396'],
  ['sasha', 'movie:38'],
];

const FOLLOWS: [string, string][] = [
  ['me', 'anya'],
  ['me', 'max'],
  ['me', 'lena'],
  ['anya', 'max'],
  ['anya', 'lena'],
  ['anya', 'sasha'],
  ['max', 'anya'],
  ['max', 'dima'],
  ['lena', 'anya'],
  ['lena', 'sasha'],
  ['dima', 'max'],
  ['sasha', 'anya'],
  ['sasha', 'lena'],
  ['sasha', 'max'],
];

/** [who likes, author, media key of the author's entry] */
const LIKES: [string, string, string][] = [
  ['max', 'anya', 'movie:157336'],
  ['lena', 'anya', 'movie:157336'],
  ['sasha', 'anya', 'movie:157336'],
  ['anya', 'max', 'movie:335984'],
  ['dima', 'max', 'movie:335984'],
  ['anya', 'lena', 'movie:194'],
  ['sasha', 'lena', 'movie:194'],
  ['lena', 'dima', 'movie:496243'],
  ['max', 'dima', 'movie:496243'],
  ['anya', 'dima', 'movie:496243'],
  ['anya', 'max', 'tv:95396'],
  ['max', 'sasha', 'tv:94605'],
  ['anya', 'sasha', 'tv:94605'],
  ['dima', 'lena', 'album:demo-a13'],
  ['lena', 'dima', 'album:demo-a6'],
  ['max', 'anya', 'album:demo-a12'],
];

const COMMENTS: [string, string, string, L][] = [
  ['anya', 'max', 'tv:95396', R('Не читала — ещё не досмотрела 🙈', 'Didn’t read it — haven’t finished yet 🙈')],
  ['lena', 'dima', 'movie:496243', R('Сцена с ливнем — лучшая в фильме', 'The rainstorm scene is the best part')],
  ['max', 'anya', 'movie:157336', R('Согласен, Циммер — гений', 'Agreed, Zimmer is a genius')],
  ['dima', 'lena', 'album:demo-a13', R('«The Chain» — вечный трек', '“The Chain” is timeless')],
  ['sasha', 'anya', 'album:demo-a12', R('А мне больше всего нравится «exile»', 'My favourite is “exile”')],
];

const LISTS: { user: string; title: L; description: L; ranked: boolean; items: string[] }[] = [
  {
    user: 'anya',
    title: R('Можно плакать', 'Allowed to cry'),
    description: R('Фильмы, после которых нужны салфетки', 'Films that need tissues'),
    ranked: false,
    items: ['movie:14160', 'movie:157336', 'movie:666277', 'movie:313369'],
  },
  {
    user: 'max',
    title: R('Космос и время', 'Space and time'),
    description: R('Мой личный топ научной фантастики', 'My personal sci-fi top'),
    ranked: true,
    items: ['movie:157336', 'movie:335984', 'movie:27205', 'movie:603', 'movie:693134'],
  },
  {
    user: 'lena',
    title: R('Воскресный вечер', 'Sunday evening'),
    description: R('Кино и пластинки для уютных выходных', 'Films and records for a cozy weekend'),
    ranked: false,
    items: ['movie:194', 'album:demo-a13', 'movie:120467', 'album:demo-a12'],
  },
];

export function buildSeed(lang: Lang, now: Date = new Date()): LocalDb {
  const ctx = { lang, region: lang === 'ru' ? 'RU' : 'US' };
  const userId = (key: string) => (key === 'me' ? ME_ID : USERS.find((u) => u.key === key)!.id);
  const snap = (key: string): MediaSnapshot => {
    const ref = parseMediaKey(key);
    const found = ref ? demoSnapshot(ref.type, ref.id, ctx) : null;
    if (!found) throw new Error(`Unknown demo title ${key}`);
    return toSnapshot(found);
  };
  const at = (daysAgo: number, salt: number) => new Date(now.getTime() - daysAgo * 86_400_000 - (salt % 9) * 3_600_000);

  const created = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const profiles: Profile[] = [
    {
      id: ME_ID,
      username: 'guest',
      displayName: lang === 'ru' ? 'Гость' : 'Guest',
      avatarEmoji: '🍿',
      bio: '',
      favFilms: [],
      favMusic: [],
      goalFilms: null,
      goalAlbums: null,
      createdAt: now.toISOString(),
    },
    {
      id: BOT_ID,
      username: 'film_buddy',
      displayName: lang === 'ru' ? 'Кинодруг' : 'Film Buddy',
      avatarEmoji: '🤖',
      bio: '',
      favFilms: [],
      favMusic: [],
      goalFilms: null,
      goalAlbums: null,
      createdAt: created,
    },
    ...USERS.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.name[lang],
      avatarEmoji: u.emoji,
      bio: u.bio[lang],
      favFilms: u.favFilms.map(snap),
      favMusic: u.favMusic.map(snap),
      goalFilms: 100,
      goalAlbums: 52,
      createdAt: created,
    })),
  ];

  const entries: Entry[] = [];
  const library = new Map<string, LibraryItem>();
  ENTRIES.forEach(([user, key, rating, liked, vibes, daysAgo, review, extra], i) => {
    const media = snap(key);
    const when = at(daysAgo, i);
    entries.push({
      id: `seed-entry-${i + 1}`,
      userId: userId(user),
      media,
      season: extra?.season ?? null,
      watchedOn: toISODate(when),
      rating,
      liked,
      rewatch: false,
      review: review ? review[lang] : null,
      spoilers: !!extra?.spoilers,
      vibes,
      createdAt: when.toISOString(),
    });
    library.set(`${userId(user)}|${key}`, {
      userId: userId(user),
      media,
      status: 'done',
      rating,
      liked,
      updatedAt: when.toISOString(),
    });
  });
  WATCHLIST.forEach(([user, key], i) => {
    library.set(`${userId(user)}|${key}`, {
      userId: userId(user),
      media: snap(key),
      status: 'want',
      rating: null,
      liked: false,
      updatedAt: at(3 + i, i).toISOString(),
    });
  });

  const entryOf = (author: string, key: string) =>
    entries.find((e) => e.userId === userId(author) && mediaKey(e.media) === key)!;

  return {
    version: LOCAL_DB_VERSION,
    meId: ME_ID,
    profiles,
    library: [...library.values()],
    entries,
    likes: LIKES.map(([who, author, key], i) => ({
      userId: userId(who),
      entryId: entryOf(author, key).id,
      createdAt: at(1, i).toISOString(),
    })),
    comments: COMMENTS.map(([who, author, key, body], i) => ({
      id: `seed-comment-${i + 1}`,
      entryId: entryOf(author, key).id,
      userId: userId(who),
      body: body[lang],
      createdAt: at(0, i + 2).toISOString(),
    })),
    follows: FOLLOWS.map(([a, b], i) => ({
      followerId: userId(a),
      followeeId: userId(b),
      createdAt: at(90 - i, i).toISOString(),
    })),
    blocks: [],
    reports: [],
    episodes: [],
    lists: LISTS.map((l, i) => ({
      id: `seed-list-${i + 1}`,
      userId: userId(l.user),
      title: l.title[lang],
      description: l.description[lang],
      ranked: l.ranked,
      createdAt: at(40 + i, i).toISOString(),
      updatedAt: at(5 + i, i).toISOString(),
    })),
    listItems: LISTS.flatMap((l, i) =>
      l.items.map((key, pos) => ({
        listId: `seed-list-${i + 1}`,
        media: snap(key),
        position: pos + 1,
        note: null,
        addedAt: at(40 + i, pos).toISOString(),
      })),
    ),
    rooms: [],
    members: [],
    swipes: [],
  };
}
