import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { EpisodeInfo } from '@/catalog/types';
import { parseMediaParam } from '@/components/media';
import { Button, ErrorState, Loader, Txt } from '@/components/ui';
import { useAction, useFilmDetails, useSeason, useSeenEpisodes } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { isAired, todayISO } from '@/lib/dates';
import { episodeKey, episodesUpTo } from '@/lib/episodes';
import { useBackend } from '@/state/session';
import { colors, gutter, space } from '@/theme';

export default function SeasonScreen() {
  const params = useLocalSearchParams<{ showId: string; season: string; media?: string }>();
  const showId = params.showId ?? '';
  const seasonNumber = Number(params.season ?? 1);
  const { t, date, runtime } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const season = useSeason(showId, seasonNumber);
  const seen = useSeenEpisodes(showId);
  const details = useFilmDetails('tv', showId);
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());

  const show = useMemo(
    () => parseMediaParam(params.media) ?? (details.data ? { ...details.data, type: 'tv' as const } : null),
    [params.media, details.data],
  );

  const seenSet = useMemo(() => {
    const set = new Set((seen.data ?? []).map(episodeKey));
    for (const [key, value] of pending) {
      if (value) set.add(key);
      else set.delete(key);
    }
    return set;
  }, [seen.data, pending]);

  const today = todayISO();
  const episodes = season.data?.episodes ?? [];
  const aired = episodes.filter((e) => isAired(e.airDate, today) || !e.airDate);
  const allSeen = aired.length > 0 && aired.every((e) => seenSet.has(episodeKey(e)));

  const mark = async (list: EpisodeInfo[] | { season: number; episode: number; runtime?: number | null }[], value: boolean) => {
    if (!show || list.length === 0) return;
    setPending((prev) => {
      const next = new Map(prev);
      for (const e of list) next.set(episodeKey(e), value);
      return next;
    });
    await act(() =>
      backend.markEpisodes(
        show,
        list.map((e) => ({ season: e.season, episode: e.episode, runtime: e.runtime ?? show.runtime ?? null })),
        value,
      ),
    );
    setPending(new Map());
  };

  const markUpTo = (episode: EpisodeInfo) => {
    const seasons = (details.data?.seasons ?? []).map((s) => ({ season: s.season, episodeCount: s.episodeCount }));
    const targets = episodesUpTo(episode, seasons).filter((e) => !seenSet.has(episodeKey(e)));
    if (targets.length === 0) return;
    Alert.alert(t('season.markUpTo'), `${targets.length}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), onPress: () => mark(targets, true) },
    ]);
  };

  const title = seasonNumber === 0 ? t('title.specials') : t('season.title', { n: seasonNumber });

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            aired.length > 0 ? (
              <Button
                small
                kind="ghost"
                title={allSeen ? t('season.unmarkAll') : t('season.markAll')}
                onPress={() => mark(aired, !allSeen)}
              />
            ) : null,
        }}
      />
      {season.isLoading ? (
        <Loader />
      ) : season.isError ? (
        <ErrorState onRetry={() => season.refetch()} />
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(e) => episodeKey(e)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {show ? <Txt v="h2">{show.title}</Txt> : null}
              <Txt v="small" tone="dim">
                {t('season.seen', { seen: episodes.filter((e) => seenSet.has(episodeKey(e))).length, total: episodes.length })}
              </Txt>
              {season.data?.overview ? (
                <Txt v="small" tone="dim" numberOfLines={4}>
                  {season.data.overview}
                </Txt>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const key = episodeKey(item);
            const isSeen = seenSet.has(key);
            const released = !item.airDate || isAired(item.airDate, today);
            return (
              <Pressable
                disabled={!released}
                onPress={() => mark([item], !isSeen)}
                onLongPress={() => markUpTo(item)}
                style={({ pressed }) => [styles.row, { opacity: !released ? 0.45 : pressed ? 0.7 : 1 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSeen, disabled: !released }}
              >
                <Ionicons
                  name={isSeen ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={isSeen ? colors.success : colors.textFaint}
                />
                <View style={styles.body}>
                  <Txt v="bodyStrong" numberOfLines={1}>
                    {`${item.episode}. ${item.name || t('season.episode', { n: item.episode })}`}
                  </Txt>
                  <Txt v="small" tone="faint">
                    {[
                      item.airDate ? date(item.airDate) : null,
                      item.runtime ? runtime(item.runtime) : null,
                      released ? null : t('season.notAired'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                  {item.overview ? (
                    <Txt v="small" tone="dim" numberOfLines={2}>
                      {item.overview}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 60,
  },
  header: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
