import type { Lang } from './lang';

type PluralForms = { ru: [string, string, string]; en: [string, string] };

export const PLURALS = {
  films: { ru: ['фильм', 'фильма', 'фильмов'], en: ['movie', 'movies'] },
  series: { ru: ['сериал', 'сериала', 'сериалов'], en: ['series', 'series'] },
  albums: { ru: ['альбом', 'альбома', 'альбомов'], en: ['album', 'albums'] },
  tracks: { ru: ['трек', 'трека', 'треков'], en: ['track', 'tracks'] },
  episodes: { ru: ['серия', 'серии', 'серий'], en: ['episode', 'episodes'] },
  ratings: { ru: ['оценка', 'оценки', 'оценок'], en: ['rating', 'ratings'] },
  followers: { ru: ['подписчик', 'подписчика', 'подписчиков'], en: ['follower', 'followers'] },
  likes: { ru: ['лайк', 'лайка', 'лайков'], en: ['like', 'likes'] },
  comments: { ru: ['комментарий', 'комментария', 'комментариев'], en: ['comment', 'comments'] },
  items: { ru: ['позиция', 'позиции', 'позиций'], en: ['item', 'items'] },
  members: { ru: ['участник', 'участника', 'участников'], en: ['member', 'members'] },
  hours: { ru: ['час', 'часа', 'часов'], en: ['hour', 'hours'] },
  reviews: { ru: ['рецензия', 'рецензии', 'рецензий'], en: ['review', 'reviews'] },
  entries: { ru: ['запись', 'записи', 'записей'], en: ['entry', 'entries'] },
  matches: { ru: ['совпадение', 'совпадения', 'совпадений'], en: ['match', 'matches'] },
  seasons: { ru: ['сезон', 'сезона', 'сезонов'], en: ['season', 'seasons'] },
  minutes: { ru: ['минута', 'минуты', 'минут'], en: ['minute', 'minutes'] },
} satisfies Record<string, PluralForms>;

export type PluralKey = keyof typeof PLURALS;

export function pluralForm(lang: Lang, key: PluralKey, n: number): string {
  const forms = PLURALS[key];
  if (lang === 'en') return Math.abs(n) === 1 ? forms.en[0] : forms.en[1];
  const abs = Math.abs(n);
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (n10 === 1 && n100 !== 11) return forms.ru[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms.ru[1];
  return forms.ru[2];
}

/** TMDB genre ids (movies and series) with Russian and English names. */
const FILM_GENRES: Record<string, { ru: string; en: string }> = {
  '28': { ru: 'Боевик', en: 'Action' },
  '12': { ru: 'Приключения', en: 'Adventure' },
  '16': { ru: 'Мультфильм', en: 'Animation' },
  '35': { ru: 'Комедия', en: 'Comedy' },
  '80': { ru: 'Криминал', en: 'Crime' },
  '99': { ru: 'Документальный', en: 'Documentary' },
  '18': { ru: 'Драма', en: 'Drama' },
  '10751': { ru: 'Семейный', en: 'Family' },
  '14': { ru: 'Фэнтези', en: 'Fantasy' },
  '36': { ru: 'История', en: 'History' },
  '27': { ru: 'Ужасы', en: 'Horror' },
  '10402': { ru: 'Музыка', en: 'Music' },
  '9648': { ru: 'Детектив', en: 'Mystery' },
  '10749': { ru: 'Мелодрама', en: 'Romance' },
  '878': { ru: 'Фантастика', en: 'Science Fiction' },
  '10770': { ru: 'Телефильм', en: 'TV Movie' },
  '53': { ru: 'Триллер', en: 'Thriller' },
  '10752': { ru: 'Военный', en: 'War' },
  '37': { ru: 'Вестерн', en: 'Western' },
  '10759': { ru: 'Боевик и приключения', en: 'Action & Adventure' },
  '10762': { ru: 'Детский', en: 'Kids' },
  '10763': { ru: 'Новости', en: 'News' },
  '10764': { ru: 'Реалити-шоу', en: 'Reality' },
  '10765': { ru: 'Фантастика и фэнтези', en: 'Sci-Fi & Fantasy' },
  '10766': { ru: 'Мыльная опера', en: 'Soap' },
  '10767': { ru: 'Ток-шоу', en: 'Talk' },
  '10768': { ru: 'Война и политика', en: 'War & Politics' },
};

export function filmGenreName(id: string, lang: Lang): string | null {
  return FILM_GENRES[id]?.[lang] ?? null;
}

const MONTHS_GENITIVE = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const MONTHS_SHORT = {
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function monthName(lang: Lang, month: number): string {
  return MONTHS_GENITIVE[lang][month];
}

export function monthShort(lang: Lang, month: number): string {
  return MONTHS_SHORT[lang][month];
}

/** Community guidelines shown in the app (required for user-generated content on the App Store). */
export const RULES: Record<Lang, string[]> = {
  ru: [
    'Уважайте других. Спорить о кино и музыке можно и нужно, переходить на личности — нельзя.',
    'Никакой травли, угроз, дискриминации и языка вражды.',
    'Помечайте спойлеры. Если рецензия раскрывает сюжет, включите переключатель «Есть спойлеры».',
    'Не публикуйте чужие персональные данные, спам, рекламу и ссылки на пиратский контент.',
    'Запрещён контент сексуального характера с участием несовершеннолетних, призывы к насилию и незаконные материалы.',
    'Увидели нарушение — нажмите «Пожаловаться». Мы рассматриваем жалобы в течение 24 часов и удаляем нарушающий контент, а авторов блокируем.',
    'Вы можете заблокировать любого пользователя: вы перестанете видеть друг друга в ленте, рецензиях и комментариях.',
  ],
  en: [
    'Be respectful. Debate films and music all you like, but never attack people.',
    'No harassment, threats, discrimination or hate speech.',
    'Mark spoilers. If a review reveals the plot, turn on "Contains spoilers".',
    "Don't post other people's personal data, spam, ads or links to pirated content.",
    'Sexual content involving minors, calls for violence and illegal material are forbidden.',
    'If you see a violation, tap "Report". We review reports within 24 hours, remove offending content and ban its authors.',
    "You can block any user: you won't see each other in feeds, reviews or comments.",
  ],
};
