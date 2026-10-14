import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { imageUrl } from '@/catalog';
import { vibeLabel } from '@/components/entry';
import { Avatar, Poster, Stars } from '@/components/media';
import { Button, ErrorState, Loader, Txt } from '@/components/ui';
import { config } from '@/config';
import { useEntry, useProfile, useYearData } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import { hashString } from '@/lib/random';
import { formatRating } from '@/lib/rating';
import { computeStats } from '@/lib/stats';
import { truncate } from '@/lib/text';
import { vibeById } from '@/lib/vibes';
import type { Domain, EntryCard, Entry, ProfileCard } from '@/lib/types';
import { colors, domainColor, gradientFor, gutter, radius, space } from '@/theme';

/** Story-sized (9:16) image of a review or of yearly stats, shared as PNG. */
export default function ShareScreen() {
  const params = useLocalSearchParams<{ entry?: string; stats?: string; user?: string; domain?: string }>();
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth - gutter * 2 - 16, 340);
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
      Alert.alert(t('share.title'), t('share.unavailable'));
      return;
    }
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      Alert.alert(t('share.title'), t('share.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View ref={ref} collapsable={false} style={{ width, height: (width * 16) / 9, borderRadius: radius.lg, overflow: 'hidden' }}>
        {params.entry ? (
          <EntryStory entryId={params.entry} width={width} />
        ) : (
          <StatsStory
            userId={params.user ?? ''}
            year={params.stats && params.stats !== 'all' ? Number(params.stats) : null}
            domain={params.domain === 'music' ? 'music' : 'film'}
            width={width}
          />
        )}
      </View>
      <Button title={t('share.shareImage')} icon="share-outline" onPress={share} loading={busy} style={styles.button} />
    </ScrollView>
  );
}

function Backdrop({ seed, poster }: { seed: string; poster?: string | null }) {
  const [from, to] = gradientFor(hashString(seed));
  const uri = imageUrl(poster, 'large');
  return (
    <>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={50} /> : null}
      <LinearGradient colors={['rgba(11,11,15,0.35)', 'rgba(11,11,15,0.85)']} style={StyleSheet.absoluteFill} />
    </>
  );
}

function Brand({ user }: { user?: Pick<ProfileCard, 'username' | 'displayName' | 'avatarEmoji'> | null }) {
  return (
    <View style={styles.brand}>
      {user ? (
        <View style={styles.brandUser}>
          <Avatar user={user} size={22} />
          <Txt v="smallStrong">{`@${user.username}`}</Txt>
        </View>
      ) : (
        <View />
      )}
      <View style={styles.brandUser}>
        <Ionicons name="aperture" size={16} color={colors.accent} />
        <Txt v="smallStrong">{config.appName}</Txt>
      </View>
    </View>
  );
}

function EntryStory({ entryId, width }: { entryId: string; width: number }) {
  const { t } = useI18n();
  const entry = useEntry(entryId);
  if (entry.isLoading) return <Loader />;
  if (!entry.data) return <ErrorState />;
  const e: EntryCard = entry.data;
  const music = e.media.type === 'album' || e.media.type === 'track';
  const quote = e.review && !e.spoilers ? truncate(e.review, 220) : null;
  return (
    <View style={styles.story}>
      <Backdrop seed={e.media.title} poster={e.media.poster} />
      <Brand user={e.author} />
      <View style={styles.storyMain}>
        <Poster media={e.media} width={music ? width * 0.62 : width * 0.5} size="large" rounded={radius.md} />
        <Txt v="title" style={styles.center} numberOfLines={3}>
          {e.media.title}
        </Txt>
        <Txt v="small" tone="dim" style={styles.center}>
          {[music ? e.media.subtitle : null, e.media.year].filter(Boolean).join(' · ')}
        </Txt>
        <View style={styles.row}>
          <Stars value={e.rating} size={24} />
          {e.liked ? <Ionicons name="heart" size={22} color={colors.like} /> : null}
        </View>
        {quote ? (
          <Txt style={styles.quote} numberOfLines={6}>
            {`«${quote}»`}
          </Txt>
        ) : null}
        {e.vibes.length ? (
          <Txt v="small" tone="dim" style={styles.center}>
            {e.vibes.map((v) => `${vibeById(v)?.emoji ?? ''} ${vibeLabel(t, v)}`).join('   ')}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

function StatsStory({ userId, year, domain, width }: { userId: string; year: number | null; domain: Domain; width: number }) {
  const { t, genre } = useI18n();
  const profile = useProfile(userId);
  const data = useYearData(userId, null);
  const stats = useMemo(() => (data.data ? computeStats(data.data.entries, data.data.episodes, year) : null), [data.data, year]);
  if (data.isLoading || profile.isLoading) return <Loader />;
  if (!stats) return <ErrorState />;

  const color = domainColor(domain);
  const s = domain === 'film' ? stats.film : stats.music;
  const inPeriod = (data.data?.entries ?? []).filter(
    (e: Entry) =>
      (!year || e.watchedOn.startsWith(`${year}-`)) &&
      (domain === 'film' ? e.media.type === 'movie' || e.media.type === 'tv' : e.media.type === 'album' || e.media.type === 'track'),
  );
  const seen = new Set<string>();
  const best = [...inPeriod]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.watchedOn.localeCompare(a.watchedOn))
    .filter((e) => {
      const k = mediaKey(e.media);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 4);
  const numbers =
    domain === 'film'
      ? [
          [stats.film.movies, t('stats.films')],
          [stats.film.episodes, t('stats.episodes')],
          [Math.round(stats.film.minutes / 60), t('stats.hours')],
        ]
      : [
          [stats.music.albums, t('stats.albums')],
          [stats.music.tracks, t('stats.tracks')],
          [Math.round(stats.music.minutes / 60), t('stats.hours')],
        ];
  const posterWidth = (width - space.xl * 2 - space.sm * 3) / 4;

  return (
    <View style={styles.story}>
      <Backdrop seed={`${userId}${year}${domain}`} poster={best[0]?.media.poster} />
      <Brand user={profile.data} />
      <View style={styles.statsMain}>
        <Txt v="caption" style={{ color }}>
          {t(domain === 'film' ? 'domain.film' : 'domain.music').toUpperCase()}
        </Txt>
        <Txt v="hero">{year ? t('share.yearTitle', { year }) : t('share.allTimeTitle')}</Txt>
        <View style={styles.numbers}>
          {numbers.map(([value, label]) => (
            <View key={String(label)} style={styles.number}>
              <Txt v="hero" style={{ color }}>
                {String(value)}
              </Txt>
              <Txt v="caption" tone="dim">
                {String(label).toUpperCase()}
              </Txt>
            </View>
          ))}
        </View>
        {s.avgRating != null ? (
          <View style={styles.row}>
            <Stars value={s.avgRating} size={18} />
            <Txt v="smallStrong" tone="dim">
              {formatRating(Math.round(s.avgRating * 10) / 10)}
            </Txt>
          </View>
        ) : null}
        {best.length ? (
          <View style={styles.posters}>
            {best.map((e) => (
              <Poster key={mediaKey(e.media)} media={e.media} width={posterWidth} size="thumb" />
            ))}
          </View>
        ) : null}
        {s.topGenres.length ? (
          <Txt v="small" tone="dim">
            {`${t('stats.topGenres')}: ${s.topGenres
              .slice(0, 3)
              .map((g) => genre(domain === 'film' ? 'movie' : 'album', g.name) ?? g.name)
              .join(', ')}`}
          </Txt>
        ) : null}
        {s.topCreators.length ? (
          <Txt v="small" tone="dim">
            {`${t(domain === 'film' ? 'stats.topDirectors' : 'stats.topArtists')}: ${s.topCreators
              .slice(0, 3)
              .map((c) => c.name)
              .join(', ')}`}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    padding: gutter,
    paddingBottom: 60,
    gap: space.xl,
  },
  button: {
    alignSelf: 'stretch',
  },
  story: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storyMain: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  center: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  quote: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: space.sm,
  },
  statsMain: {
    flex: 1,
    justifyContent: 'center',
    gap: space.md,
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: space.sm,
  },
  number: {
    gap: 2,
  },
  posters: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
