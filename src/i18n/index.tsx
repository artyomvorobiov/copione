import { createContext, useContext } from 'react';

import { localDayOf, parseISODate, todayISO } from '@/lib/dates';
import type { MediaType } from '@/lib/types';

import { en } from './en';
import { filmGenreName, monthName, monthShort, pluralForm, type PluralKey } from './extra';
import type { Lang } from './lang';
import { ru, type TKey } from './ru';

export type { TKey } from './ru';
export type { Lang, LangSetting } from './lang';

const DICTS: Record<Lang, Record<TKey, string>> = { ru, en };

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, params?: Params): string {
  let s: string = DICTS[lang][key] ?? ru[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

function groupThousands(n: number, sep: string): string {
  const s = String(Math.round(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return n < 0 ? `-${grouped}` : grouped;
}

export interface Translator {
  lang: Lang;
  t: (key: TKey, params?: Params) => string;
  /** "5 фильмов" / "5 movies" */
  plural: (key: PluralKey, n: number) => string;
  /** Just the word: "фильмов" / "movies" */
  pluralWord: (key: PluralKey, n: number) => string;
  /** "14 октября" / "Oct 14"; the year is added when it is not the current one. */
  date: (iso: string) => string;
  /** "5 мин назад" for recent timestamps, otherwise a date. */
  timeAgo: (timestamp: string) => string;
  /** Minutes as "2 ч 15 мин". */
  runtime: (minutes: number | null | undefined) => string;
  /** Seconds as "3:45". */
  duration: (seconds: number | null | undefined) => string;
  /** Localized genre name; music genres are already names. */
  genre: (type: MediaType, key: string) => string | null;
  monthShort: (month: number) => string;
  number: (n: number) => string;
}

export function createTranslator(lang: Lang): Translator {
  const t = (key: TKey, params?: Params) => translate(lang, key, params);

  const date = (iso: string) => {
    const day = iso.length > 10 ? localDayOf(iso) : iso;
    const d = parseISODate(day);
    const sameYear = d.getFullYear() === parseISODate(todayISO()).getFullYear();
    if (lang === 'ru') {
      return `${d.getDate()} ${monthName('ru', d.getMonth())}${sameYear ? '' : ` ${d.getFullYear()}`}`;
    }
    const m = monthShort('en', d.getMonth());
    return sameYear ? `${m} ${d.getDate()}` : `${m} ${d.getDate()}, ${d.getFullYear()}`;
  };

  return {
    lang,
    t,
    plural: (key, n) => `${groupThousands(n, lang === 'ru' ? ' ' : ',')} ${pluralForm(lang, key, n)}`,
    pluralWord: (key, n) => pluralForm(lang, key, n),
    date,
    timeAgo: (timestamp) => {
      const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
      if (!Number.isFinite(diff)) return '';
      if (diff < 60) return t('time.now');
      if (diff < 3600) return t('time.minutes', { n: Math.floor(diff / 60) });
      if (diff < 86400) return t('time.hours', { n: Math.floor(diff / 3600) });
      if (diff < 7 * 86400) return t('time.days', { n: Math.floor(diff / 86400) });
      return date(timestamp);
    },
    runtime: (minutes) => {
      if (!minutes || minutes <= 0) return '';
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      if (h === 0) return t('runtime.minutes', { m });
      if (m === 0) return t('runtime.hours', { h });
      return t('runtime.hoursMinutes', { h, m });
    },
    duration: (seconds) => {
      if (!seconds || seconds <= 0) return '';
      const total = Math.round(seconds);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    },
    genre: (type, key) => (type === 'movie' || type === 'tv' ? filmGenreName(key, lang) : key || null),
    monthShort: (month) => monthShort(lang, month),
    number: (n) => groupThousands(n, lang === 'ru' ? ' ' : ','),
  };
}

export const I18nContext = createContext<Translator>(createTranslator('ru'));

export function useI18n(): Translator {
  return useContext(I18nContext);
}
