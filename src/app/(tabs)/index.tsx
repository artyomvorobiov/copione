import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EntryCard } from '@/components/entry';
import { Screen, TabHeader, useBottomInset } from '@/components/layout';
import { Avatar, displayName, openMedia, openUser, Poster } from '@/components/media';
import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, Loader, Section, Txt } from '@/components/ui';
import {
  useAction,
  useFeed,
  useFilmDetails,
  useShowsInProgress,
  useSuggestedProfiles,
} from '@/hooks/data';
import { useI18n } from '@/i18n';
import { episodeCode, nextEpisode } from '@/lib/episodes';
import type { Domain, ShowInProgress } from '@/lib/types';
import { useBackend, useSession } from '@/state/session';
import { colors, gutter, radius, space } from '@/theme';

export default function FeedScreen() {
  const { t } = useI18n();
  const { mode } = useSession();
  const [domain, setDomain] = useState<Domain | undefined>(undefined);
  const feed = useFeed(domain);
  const shows = useShowsInProgress();
  const bottom = useBottomInset();
  const entries = feed.data?.pages.flat() ?? [];

  const header = (
    <View>
      <TabHeader title={t('feed.title')} />
      {mode === 'local' ? (
        <Card style={styles.banner}>
          <View style={styles.bannerRow}>
            <Ionicons name="flask-outline" size={18} color={colors.accent} />
            <Txt v="small" tone="dim" style={styles.flex}>
              {t('feed.demoBanner')}
            </Txt>
          </View>
        </Card>
      ) : null}
      <ContinueWatching shows={shows.data ?? []} />
      <Section title={t('feed.friends')} padded={false}>
        <ChipRow>
          <Chip label={t('filter.all')} selected={!domain} onPress={() => setDomain(undefined)} />
          <Chip label={t('domain.film')} selected={domain === 'film'} onPress={() => setDomain('film')} />
          <Chip label={t('domain.music')} selected={domain === 'music'} onPress={() => setDomain('music')} color={colors.music} />
        </ChipRow>
      </Section>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.isLoading ? <Loader /> : feed.isError ? <ErrorState onRetry={() => feed.refetch()} /> : <EmptyFeed />
        }
        ListFooterComponent={
          feed.hasNextPage ? (
            <Button
              title={t('feed.loadMore')}
              kind="ghost"
              small
              loading={feed.isFetchingNextPage}
              onPress={() => feed.fetchNextPage()}
              style={styles.more}
            />
          ) : null
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              feed.refetch();
              shows.refetch();
            }}
            tintColor={colors.textDim}
          />
        }
        contentContainerStyle={{ paddingBottom: bottom }}
        contentInsetAdjustmentBehavior="never"
      />
    </Screen>
  );
}

function EmptyFeed() {
  const { t } = useI18n();
  const suggested = useSuggestedProfiles();
  const backend = useBackend();
  const act = useAction();
  return (
    <View>
      <EmptyState
        icon="people-outline"
        title={t('feed.emptyTitle')}
        text={t('feed.emptyText')}
        action={t('feed.findPeople')}
        onAction={() => router.push({ pathname: '/discover', params: { tab: 'people' } })}
      />
      {(suggested.data ?? []).length > 0 ? (
        <Section title={t('feed.suggested')}>
          {suggested.data!.map((p) => (
            <Pressable key={p.id} style={styles.person} onPress={() => openUser(p.id)}>
              <Avatar user={p} size={40} />
              <View style={styles.flex}>
                <Txt v="bodyStrong">{displayName(p)}</Txt>
                <Txt v="small" tone="faint">{`@${p.username}`}</Txt>
              </View>
              <Button title={t('profile.follow')} small onPress={() => act(() => backend.setFollow(p.id, true))} />
            </Pressable>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function ContinueWatching({ shows }: { shows: ShowInProgress[] }) {
  const { t } = useI18n();
  if (shows.length === 0) return null;
  return (
    <Section title={t('feed.continue')} padded={false}>
      <FlatList
        horizontal
        data={shows.slice(0, 12)}
        keyExtractor={(s) => s.media.id}
        renderItem={({ item }) => <ContinueCard show={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.continueRow}
      />
    </Section>
  );
}

function ContinueCard({ show }: { show: ShowInProgress }) {
  const { t, date } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const details = useFilmDetails('tv', show.media.id);
  const [busy, setBusy] = useState(false);

  const seasons = (details.data?.seasons ?? []).map((s) => ({ season: s.season, episodeCount: s.episodeCount }));
  const lastAired = details.data?.lastEpisode ?? null;
  const next = details.data ? nextEpisode([show.last], seasons, lastAired) : null;
  const upcoming = details.data?.nextEpisode;

  // Finished shows without new episodes leave the shelf.
  if (details.data && !next && (show.status === 'done' || !upcoming)) return null;

  const markNext = async () => {
    if (!next) return;
    setBusy(true);
    await act(() => backend.markEpisodes(show.media, [{ ...next, runtime: show.media.runtime ?? null }], true));
    setBusy(false);
  };

  return (
    <Pressable style={styles.continueCard} onPress={() => openMedia(show.media)}>
      <Poster media={show.media} width={84} size="thumb" />
      <View style={styles.continueBody}>
        <Txt v="smallStrong" numberOfLines={2}>
          {show.media.title}
        </Txt>
        <Txt v="small" tone="dim" numberOfLines={2}>
          {next
            ? t('feed.next', { code: episodeCode(next) })
            : upcoming?.airDate
              ? t('feed.newEpisode', { date: date(upcoming.airDate) })
              : details.isLoading
                ? '…'
                : t('feed.caughtUp')}
        </Txt>
        {next ? (
          <Button title={t('feed.markSeen')} icon="checkmark" small kind="secondary" loading={busy} onPress={markNext} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  banner: {
    marginHorizontal: gutter,
    marginTop: space.sm,
    padding: space.md,
  },
  bannerRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  continueRow: {
    paddingHorizontal: gutter,
    gap: space.md,
  },
  continueCard: {
    width: 250,
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  continueBody: {
    flex: 1,
    gap: space.xs,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  more: {
    alignSelf: 'center',
    marginVertical: space.lg,
  },
});
