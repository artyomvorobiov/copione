import { getLocales } from 'expo-localization';

export type Lang = 'ru' | 'en';
export type LangSetting = 'auto' | Lang;

/** Languages of the former USSR where Russian is widely understood. */
const RUSSIAN_FRIENDLY = new Set(['ru', 'uk', 'be', 'kk', 'ky', 'uz', 'tg', 'hy', 'az', 'ka', 'tk', 'mo']);

export function deviceLocale(): { languageCode: string; regionCode: string | null } {
  try {
    const locale = getLocales()[0];
    return {
      languageCode: (locale?.languageCode ?? 'en').toLowerCase(),
      regionCode: locale?.regionCode ? locale.regionCode.toUpperCase() : null,
    };
  } catch {
    return { languageCode: 'en', regionCode: null };
  }
}

export function resolveLang(setting: LangSetting): Lang {
  if (setting !== 'auto') return setting;
  return RUSSIAN_FRIENDLY.has(deviceLocale().languageCode) ? 'ru' : 'en';
}

/** Two-letter country used for streaming providers and the Apple Music storefront. */
export function resolveRegion(override: string | null, lang: Lang): string {
  if (override) return override.toUpperCase();
  return deviceLocale().regionCode ?? (lang === 'ru' ? 'RU' : 'US');
}

/** TMDB `language` parameter. */
export function tmdbLanguage(lang: Lang): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}
