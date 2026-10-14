import { Platform } from 'react-native';

/**
 * App configuration from environment variables (see .env.example).
 * Expo inlines EXPO_PUBLIC_* values at build time, so each one must be read
 * as a literal `process.env.EXPO_PUBLIC_…` expression.
 */
const tmdbKey = (process.env.EXPO_PUBLIC_TMDB_KEY ?? '').trim();
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const forceDemo = process.env.EXPO_PUBLIC_DEMO === '1';

export const config = {
  appName: 'Copione',
  tmdbKey,
  tmdbApiBase: (process.env.EXPO_PUBLIC_TMDB_API_BASE || 'https://api.themoviedb.org/3').replace(/\/$/, ''),
  tmdbImageBase: (process.env.EXPO_PUBLIC_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p').replace(/\/$/, ''),
  itunesApiBase: (process.env.EXPO_PUBLIC_ITUNES_API_BASE || 'https://itunes.apple.com').replace(/\/$/, ''),
  supabaseUrl,
  supabaseKey,
  privacyUrl: (process.env.EXPO_PUBLIC_PRIVACY_URL ?? '').trim(),
  supportEmail: (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim(),

  /** Real film catalog (TMDB) instead of the bundled demo titles. */
  hasTmdb: !!tmdbKey && !forceDemo,
  /** Accounts and the social features live in Supabase; otherwise data stays on the device. */
  hasSupabase: !!supabaseUrl && !!supabaseKey && !forceDemo,
  /**
   * The iTunes Search API needs no key. Browsers block it (no CORS headers),
   * so the web build uses the bundled demo albums.
   */
  liveMusic: Platform.OS !== 'web' && !forceDemo,
};
