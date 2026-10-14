# Copione — notes for AI assistants and contributors

Letterboxd-style diary for films, series **and music** (albums, EPs, singles, tracks). Expo SDK 57 / React Native 0.86 / TypeScript, Expo Router with native tabs. UI is Russian-first with English.

## Commands

```bash
npx expo start            # run in Expo Go (add -c after editing .env)
npm test                  # jest: pure logic + LocalBackend
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint (React Compiler rules are on)
npm run test:supabase     # SupabaseBackend vs local Supabase in Docker (tests/supabase/README.md)
npx expo install <pkg>    # always use this to add native deps (SDK-compatible versions)
```

Run typecheck, lint and tests before finishing a change.

## Architecture

- `src/app/` — routes (Expo Router). `(tabs)/` = Feed, Discover, Match, Profile. Modals: `log`, `list-edit`, `add-to-list`, `match-new`, `edit-profile`, `pick-favorites`, `share`.
- `src/backend/` — `Backend` interface (`types.ts`) with two implementations:
  - `SupabaseBackend` (cloud; tables, RLS and RPCs in `supabase/schema.sql`),
  - `LocalBackend` (demo mode: JSON in AsyncStorage + seeded demo community in `seed.ts`, a bot plays Match).
  The mode is chosen by env vars in `src/config.ts`.
- `src/catalog/` — `FilmCatalog` (TMDB or bundled demo) and `MusicCatalog` (iTunes Search API; ids starting with `demo-` always resolve to bundled demo albums).
- `src/lib/` — framework-free logic with unit tests (taste match, stats, episodes, CSV/Letterboxd, decks, vibes, moods).
- `src/hooks/data.ts` — all TanStack Query hooks. Catalog query keys start with `'cat'`; mutations call `useInvalidateUserData()` which refetches everything else.
- `src/state/` — settings (+ i18n provider), session/auth, audio preview player, toasts.

## Conventions

- Every UI string goes to both `src/i18n/ru.ts` and `src/i18n/en.ts` (`en` is typed against `ru`, so a missing key fails `tsc`). Avoid gendered Russian verbs in UI copy (use «Просмотрено», «Отметить», «Читает вас»).
- Data model changes: edit `supabase/schema.sql` idempotently (`if not exists`, `create or replace`, `drop policy if exists`), then update **both** backends, `src/lib/types.ts`, and the tests in `src/backend/__tests__` and `tests/supabase/backend.test.ts`.
- Media are identified by `{ type: 'movie' | 'tv' | 'album' | 'track', id: string }`; user data stores a denormalized `MediaSnapshot` (title, poster, year, genres, runtime, creator).
- Colors, spacing and fonts come from `src/theme.ts` (single dark theme; films use `colors.accent`, music `colors.music`).
- Expo APIs change between SDKs — check the installed package types in `node_modules` rather than memory.
