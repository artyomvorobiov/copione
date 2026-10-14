import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { TrackItem } from '@/catalog/types';
import { MediaCard, openMedia, StarInput, Stars } from '@/components/media';
import { Button, Card, ErrorState, Loader, Section, Txt } from '@/components/ui';
import { useAlbum, useLibraryItem, useLibraryItems, useLibraryMutation, useTrack } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { toSnapshot } from '@/lib/media';
import { formatRating, suggestedAlbumRating } from '@/lib/rating';
import type { LibraryItem, MediaSnapshot } from '@/lib/types';
import { usePlayer } from '@/state/player';
import { colors, gutter, radius, space } from '@/theme';

import { Hero } from './Hero';
import { ActionPanel, CommunitySection, FriendsSection, ReviewsSection } from './sections';

export function PreviewButton({ url, size = 30 }: { url: string | null | undefined; size?: number }) {
  const { playingUrl, toggle } = usePlayer();
  const { t } = useI18n();
  if (!url) return null;
  const playing = playingUrl === url;
  return (
    <Pressable
      hitSlop={8}
      onPress={() => toggle(url)}
      accessibilityRole="button"
      accessibilityLabel={t('title.preview')}
      style={styles.preview}
    >
      <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={size} color={playing ? colors.music : colors.textDim} />
    </Pressable>
  );
}

/** One row of an album tracklist with an inline, expandable rating. */
function TrackRow({ track, item }: { track: TrackItem; item: LibraryItem | undefined }) {
  const { duration } = useI18n();
  const [rating, setRating] = useState(false);
  const snapshot = useMemo(() => toSnapshot(track), [track]);
  const mutate = useLibraryMutation(snapshot);
  return (
    <View style={styles.trackWrap}>
      <Pressable style={({ pressed }) => [styles.track, { opacity: pressed ? 0.75 : 1 }]} onPress={() => openMedia(track)}>
        <Txt v="small" tone="faint" style={styles.trackNo}>
          {track.number || '·'}
        </Txt>
        <View style={styles.flex}>
          <Txt numberOfLines={1}>{track.title}</Txt>
          <Txt v="small" tone="faint">
            {duration(track.durationSec)}
          </Txt>
        </View>
        <PreviewButton url={track.previewUrl} size={26} />
        <Pressable
          hitSlop={8}
          onPress={() => setRating((v) => !v)}
          style={styles.trackRating}
          accessibilityRole="button"
          accessibilityLabel={item?.rating ? `${item.rating} / 5` : 'rate'}
        >
          {item?.rating ? (
            <Stars value={item.rating} size={11} />
          ) : (
            <Ionicons name="star-outline" size={18} color={colors.textFaint} />
          )}
        </Pressable>
      </Pressable>
      {rating ? (
        <View style={styles.inlineRating}>
          <StarInput
            value={item?.rating ?? null}
            size={30}
            color={colors.music}
            onChange={(value) => {
              mutate(value == null ? { rating: null } : { rating: value, status: 'done' });
              setRating(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function TrackAverage({ album, tracks }: { album: MediaSnapshot; tracks: LibraryItem[] }) {
  const { t } = useI18n();
  const { item } = useLibraryItem(album);
  const mutate = useLibraryMutation(album);
  const avg = suggestedAlbumRating(tracks.map((tr) => tr.rating));
  if (avg == null || tracks.filter((tr) => tr.rating != null).length < 2 || item?.rating === avg) return null;
  return (
    <Card style={styles.average}>
      <Ionicons name="analytics-outline" size={20} color={colors.music} />
      <Txt v="small" style={styles.flex}>
        {t('title.tracksAverage', { value: formatRating(avg) })}
      </Txt>
      <Button title={t('title.apply')} small kind="secondary" onPress={() => mutate({ rating: avg, status: 'done' })} />
    </Card>
  );
}

export function AlbumView({ id }: { id: string }) {
  const { t, plural, runtime } = useI18n();
  const album = useAlbum(id);
  const a = album.data;
  const media = useMemo(() => (a ? toSnapshot(a) : null), [a]);
  const trackRefs = useMemo(() => (a ? a.tracks.map((tr) => ({ type: 'track' as const, id: tr.id })) : []), [a]);
  const trackItems = useLibraryItems(trackRefs);

  if (album.isLoading) return <Loader style={styles.fill} />;
  if (album.isError || !a || !media) return <ErrorState onRetry={() => album.refetch()} />;

  const byId = new Map((trackItems.data ?? []).map((i) => [i.media.id, i]));
  const lines = [
    a.artistName,
    [t(`kind.${a.kind}`), a.year, a.genreNames[0]].filter(Boolean).join(' · '),
    [plural('tracks', a.tracks.length), a.durationSec ? runtime(Math.round(a.durationSec / 60)) : null].filter(Boolean).join(' · '),
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Hero media={media} lines={lines}>
        {a.artistId ? (
          <Pressable onPress={() => router.push({ pathname: '/artist/[id]', params: { id: a.artistId! } })} hitSlop={6}>
            <Txt v="smallStrong" tone="music">
              {`${t('title.discography')} ›`}
            </Txt>
          </Pressable>
        ) : null}
      </Hero>
      <ActionPanel media={media} />
      <TrackAverage album={media} tracks={trackItems.data ?? []} />
      <Section title={t('title.tracklist')}>
        <View style={styles.tracklist}>
          {a.tracks.map((track) => (
            <TrackRow key={track.id} track={track} item={byId.get(track.id)} />
          ))}
        </View>
        {a.copyright ? (
          <Txt v="caption" tone="faint" style={styles.copyright}>
            {a.copyright}
          </Txt>
        ) : null}
      </Section>
      <CommunitySection media={media} />
      <FriendsSection media={media} />
      <ReviewsSection media={media} />
      {a.externalUrl ? (
        <Section>
          <Button
            title={t('title.openAppleMusic')}
            icon="musical-notes-outline"
            kind="secondary"
            onPress={() => WebBrowser.openBrowserAsync(a.externalUrl!)}
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

export function TrackView({ id }: { id: string }) {
  const { t, duration } = useI18n();
  const track = useTrack(id);
  const tr = track.data;
  const media = useMemo(() => (tr ? toSnapshot(tr) : null), [tr]);

  if (track.isLoading) return <Loader style={styles.fill} />;
  if (track.isError || !tr || !media) return <ErrorState onRetry={() => track.refetch()} />;

  const lines = [tr.artistName, [t('media.track'), tr.year, tr.genreNames[0], duration(tr.durationSec)].filter(Boolean).join(' · ')];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Hero media={media} lines={lines}>
        <PreviewButton url={tr.previewUrl} size={44} />
      </Hero>
      <ActionPanel media={media} />
      {tr.album ? (
        <Section title={t('title.fromAlbum')}>
          <MediaCard media={tr.album} width={120} />
        </Section>
      ) : null}
      <CommunitySection media={media} />
      <FriendsSection media={media} />
      <ReviewsSection media={media} />
      {tr.externalUrl ? (
        <Section>
          <Button
            title={t('title.openAppleMusic')}
            icon="musical-notes-outline"
            kind="secondary"
            onPress={() => WebBrowser.openBrowserAsync(tr.externalUrl!)}
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    marginTop: 120,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tracklist: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  trackWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  trackNo: {
    width: 22,
    textAlign: 'center',
  },
  trackRating: {
    minWidth: 44,
    minHeight: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  inlineRating: {
    paddingBottom: space.md,
  },
  average: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: gutter,
    marginTop: space.md,
    padding: space.md,
  },
  copyright: {
    marginTop: space.sm,
  },
});
