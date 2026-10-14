import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { BackendError } from '@/backend/types';
import { CatalogError } from '@/catalog/types';
import { useI18n } from '@/i18n';
import { yearRange } from '@/lib/dates';
import { mediaKey } from '@/lib/media';
import { moodById } from '@/lib/moods';
import type { Domain, LibraryFilter, LibraryItem, LibraryPatch, MediaRef, MediaSnapshot } from '@/lib/types';
import { useCatalogs } from '@/state/catalogs';
import { useBackend } from '@/state/session';

const CAT = 'cat';
const LONG = 30 * 60 * 1000;

/* ------------------------------------------------------------------------- */
/* Catalog queries (TMDB / Apple Music / demo)                               */
/* ------------------------------------------------------------------------- */

export function useTrending(type: 'movie' | 'tv') {
  const { film, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'film', 'trending', type, ctx.lang],
    queryFn: () => film.trending(type, ctx),
    staleTime: LONG,
  });
}

export function useFilmSearch(query: string) {
  const { film, ctx } = useCatalogs();
  const q = query.trim();
  return useQuery({
    queryKey: [CAT, 'film', 'search', q, ctx.lang],
    queryFn: () => film.search(q, ctx),
    enabled: q.length >= 2,
    staleTime: LONG,
  });
}

export function useMoodPicks(moodId: string | null, type: 'movie' | 'tv') {
  const { film, ctx } = useCatalogs();
  const mood = moodId ? moodById(moodId) : undefined;
  return useQuery({
    queryKey: [CAT, 'film', 'mood', moodId, type, ctx.lang],
    queryFn: () => film.discover(type, mood![type], mood!.without ?? [], ctx),
    enabled: !!mood,
    staleTime: LONG,
  });
}

export function useFilmDetails(type: 'movie' | 'tv', id: string, enabled = true) {
  const { film, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'film', 'details', type, id, ctx.lang, ctx.region],
    queryFn: () => film.details(type, id, ctx),
    enabled,
    staleTime: LONG,
  });
}

export function useSeason(showId: string, season: number) {
  const { film, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'film', 'season', showId, season, ctx.lang],
    queryFn: () => film.season(showId, season, ctx),
    staleTime: LONG,
  });
}

export function useMusicCharts(kind: 'albums' | 'songs') {
  const { music, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'music', 'charts', kind, ctx.region],
    queryFn: () => music.charts(kind, ctx),
    staleTime: LONG,
  });
}

export function useMusicSearch(query: string) {
  const { music, ctx } = useCatalogs();
  const q = query.trim();
  return useQuery({
    queryKey: [CAT, 'music', 'search', q, ctx.region],
    queryFn: () => music.search(q, ctx),
    enabled: q.length >= 2,
    staleTime: LONG,
  });
}

export function useAlbum(id: string, enabled = true) {
  const { music, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'music', 'album', id, ctx.region],
    queryFn: () => music.album(id, ctx),
    enabled,
    staleTime: LONG,
  });
}

export function useTrack(id: string, enabled = true) {
  const { music, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'music', 'track', id, ctx.region],
    queryFn: () => music.track(id, ctx),
    enabled,
    staleTime: LONG,
  });
}

export function useArtist(id: string) {
  const { music, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'music', 'artist', id, ctx.region],
    queryFn: () => music.artist(id, ctx),
    staleTime: LONG,
  });
}

export function useSoundtracks(title: string | undefined, originalTitle: string | null | undefined) {
  const { music, ctx } = useCatalogs();
  return useQuery({
    queryKey: [CAT, 'music', 'soundtracks', title, originalTitle, ctx.region],
    queryFn: () => music.soundtracks(title!, originalTitle ?? null, ctx),
    enabled: !!title,
    staleTime: LONG,
    retry: false,
  });
}

/* ------------------------------------------------------------------------- */
/* Backend queries                                                           */
/* ------------------------------------------------------------------------- */

export function useProfile(userId: string | undefined) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => backend.getProfile(userId!),
    enabled: !!userId,
  });
}

export function useLibraryItems(refs: MediaRef[]) {
  const backend = useBackend();
  const keys = refs.map(mediaKey).sort().join(',');
  return useQuery({
    queryKey: ['library', keys],
    queryFn: () => backend.getLibraryItems(refs),
    enabled: refs.length > 0,
  });
}

export function useLibraryItem(ref: MediaRef) {
  const query = useLibraryItems([ref]);
  return { ...query, item: query.data?.[0] ?? null };
}

export function useTitleStats(ref: MediaRef) {
  const backend = useBackend();
  return useQuery({ queryKey: ['stats', mediaKey(ref)], queryFn: () => backend.getTitleStats(ref) });
}

export function useFriendsOn(ref: MediaRef) {
  const backend = useBackend();
  return useQuery({ queryKey: ['friends', mediaKey(ref)], queryFn: () => backend.getFriendsOn(ref) });
}

export function useMediaEntries(ref: MediaRef, limit = 5) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['entries', 'media', mediaKey(ref), limit],
    queryFn: () => backend.getMediaEntries(ref, { limit }),
  });
}

export function useEntry(id: string, enabled = true) {
  const backend = useBackend();
  return useQuery({ queryKey: ['entry', id], queryFn: () => backend.getEntry(id), enabled: enabled && !!id });
}

export function useComments(entryId: string) {
  const backend = useBackend();
  return useQuery({ queryKey: ['comments', entryId], queryFn: () => backend.getComments(entryId) });
}

const FEED_PAGE = 20;

export function useFeed(domain: Domain | undefined) {
  const backend = useBackend();
  return useInfiniteQuery({
    queryKey: ['feed', domain ?? 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => backend.getFeed({ before: pageParam, limit: FEED_PAGE, domain }),
    getNextPageParam: (last) => (last.length < FEED_PAGE ? undefined : last[last.length - 1].createdAt),
  });
}

const DIARY_PAGE = 30;

export function useUserEntries(userId: string, domain?: Domain) {
  const backend = useBackend();
  return useInfiniteQuery({
    queryKey: ['entries', 'user', userId, domain ?? 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => backend.getUserEntries(userId, { offset: pageParam, limit: DIARY_PAGE, domain }),
    getNextPageParam: (last, pages) => (last.length < DIARY_PAGE ? undefined : pages.length * DIARY_PAGE),
  });
}

export function useUserLibrary(userId: string, filter: LibraryFilter, domain?: Domain) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['userLibrary', userId, filter, domain ?? 'all'],
    queryFn: () => backend.getUserLibrary(userId, filter, domain),
  });
}

export function useTastePairs(otherUserId: string | undefined) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['taste', otherUserId],
    queryFn: () => backend.tastePairs(otherUserId!),
    enabled: !!otherUserId && otherUserId !== backend.userId,
  });
}

export function useSeenEpisodes(showId: string, enabled = true) {
  const backend = useBackend();
  return useQuery({ queryKey: ['progress', showId], queryFn: () => backend.getSeenEpisodes(showId), enabled });
}

export function useShowsInProgress() {
  const backend = useBackend();
  return useQuery({ queryKey: ['inprogress'], queryFn: () => backend.getShowsInProgress() });
}

export function useUserLists(userId: string) {
  const backend = useBackend();
  return useQuery({ queryKey: ['lists', userId], queryFn: () => backend.getUserLists(userId) });
}

export function useList(id: string) {
  const backend = useBackend();
  return useQuery({ queryKey: ['list', id], queryFn: () => backend.getList(id), enabled: !!id });
}

export function useListsContaining(ref: MediaRef) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['listsContaining', mediaKey(ref)],
    queryFn: () => backend.listsContaining(ref),
    enabled: !!ref.id,
  });
}

export function useRoomState(roomId: string) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['room', roomId],
    queryFn: () => backend.getRoomState(roomId),
    refetchInterval: 2500,
  });
}

export function useMyRooms() {
  const backend = useBackend();
  return useQuery({ queryKey: ['rooms'], queryFn: () => backend.myRooms() });
}

export function useSuggestedProfiles() {
  const backend = useBackend();
  return useQuery({ queryKey: ['suggested'], queryFn: () => backend.suggestedProfiles() });
}

export function useProfileSearch(query: string) {
  const backend = useBackend();
  const q = query.trim();
  return useQuery({
    queryKey: ['peopleSearch', q],
    queryFn: () => backend.searchProfiles(q),
    enabled: q.length >= 1,
  });
}

export function useFollows(userId: string, kind: 'followers' | 'following') {
  const backend = useBackend();
  return useQuery({ queryKey: ['follows', userId, kind], queryFn: () => backend.listFollows(userId, kind) });
}

export function useBlocked() {
  const backend = useBackend();
  return useQuery({ queryKey: ['blocked'], queryFn: () => backend.listBlocked() });
}

/** Diary entries and seen episodes of a year (or all time) for the stats screen. */
export function useYearData(userId: string, year: number | null) {
  const backend = useBackend();
  return useQuery({
    queryKey: ['yearData', userId, year],
    queryFn: async () => {
      const range = year == null ? { from: '1900-01-01', to: '2999-12-31' } : yearRange(year);
      const [entries, episodes] = await Promise.all([
        backend.getEntriesBetween(userId, range.from, range.to),
        backend.getEpisodesSeenBetween(userId, `${range.from}T00:00:00`, `${range.to}T23:59:59.999`),
      ]);
      return { entries, episodes };
    },
  });
}

/* ------------------------------------------------------------------------- */
/* Mutations                                                                 */
/* ------------------------------------------------------------------------- */

/** Refetch everything that depends on the user's data (catalog caches stay). */
export function useInvalidateUserData() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== CAT }), [qc]);
}

export function errorMessage(err: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (err instanceof BackendError) {
    switch (err.code) {
      case 'room_not_found':
        return t('match.notFound');
      case 'room_full':
        return t('match.full');
      case 'username_taken':
        return t('editProfile.usernameTaken');
      case 'network':
        return t('common.networkError');
      default:
        return t('common.error');
    }
  }
  if (err instanceof CatalogError) return t('common.networkError');
  return t('common.error');
}

/**
 * Runs a backend call, refreshes user data and reports errors in an alert.
 * Resolves to true on success.
 */
export function useAction() {
  const invalidate = useInvalidateUserData();
  const { t } = useI18n();
  return useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        await invalidate();
        return true;
      } catch (err) {
        Alert.alert(t('error.title'), errorMessage(err, t));
        return false;
      }
    },
    [invalidate, t],
  );
}

/**
 * Optimistic rating / like / watchlist changes for one title: the UI updates
 * immediately, then the backend is called and related data is refreshed.
 */
export function useLibraryMutation(media: MediaSnapshot | null) {
  const backend = useBackend();
  const qc = useQueryClient();
  const invalidate = useInvalidateUserData();
  const { t } = useI18n();

  return useCallback(
    async (patch: LibraryPatch) => {
      if (!media) return;
      const key = ['library', mediaKey(media)];
      const previous = qc.getQueryData<LibraryItem[]>(key);
      const current = previous?.[0];
      const next: LibraryItem = {
        userId: backend.userId,
        media,
        status: patch.status !== undefined ? patch.status : current?.status ?? null,
        rating: patch.rating !== undefined ? patch.rating : current?.rating ?? null,
        liked: patch.liked !== undefined ? patch.liked : current?.liked ?? false,
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData(key, [next]);
      try {
        await backend.setLibrary(media, patch);
      } catch (err) {
        qc.setQueryData(key, previous);
        Alert.alert(t('error.title'), errorMessage(err, t));
        return;
      }
      await invalidate();
    },
    [backend, invalidate, media, qc, t],
  );
}
