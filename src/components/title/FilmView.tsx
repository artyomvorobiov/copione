import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { imageUrl } from '@/catalog';
import type { FilmDetails, Provider } from '@/catalog/types';
import { MediaRow, mediaParam } from '@/components/media';
import { Button, ErrorState, Loader, ProgressBar, Section, Txt } from '@/components/ui';
import { useFilmDetails, useSeenEpisodes, useSoundtracks } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { airedEpisodes, seenRegularCount } from '@/lib/episodes';
import { toSnapshot } from '@/lib/media';
import type { MediaSnapshot } from '@/lib/types';
import { colors, gutter, radius, space } from '@/theme';

import { Hero } from './Hero';
import { ActionPanel, CommunitySection, ExpandableText, FriendsSection, ReviewsSection } from './sections';

export function FilmView({ type, id }: { type: 'movie' | 'tv'; id: string }) {
  const { t, genre, runtime } = useI18n();
  const details = useFilmDetails(type, id);
  const seen = useSeenEpisodes(id);

  const d = details.data;
  const media = useMemo(() => (d ? toSnapshot(d) : null), [d]);

  const isSeasonUnseen = useMemo(() => {
    if (type !== 'tv' || !d) return undefined;
    return (season: number) => {
      const total = d.seasons.find((s) => s.season === season)?.episodeCount ?? 0;
      const watched = (seen.data ?? []).filter((e) => e.season === season).length;
      return total > 0 && watched < total;
    };
  }, [type, d, seen.data]);

  if (details.isLoading) return <Loader style={styles.fill} />;
  if (details.isError || !d || !media) return <ErrorState onRetry={() => details.refetch()} />;

  const genres = d.genreNames.length
    ? d.genreNames
    : (d.genres ?? []).map((g) => genre(type, g)).filter((g): g is string => !!g);
  const lines = [
    d.subtitle,
    [type === 'tv' ? t('media.tv') : null, d.year, d.runtime ? (type === 'tv' ? `~${runtime(d.runtime)}` : runtime(d.runtime)) : null]
      .filter(Boolean)
      .join(' · '),
    genres.slice(0, 3).join(', ') || null,
    d.directors.length ? `${t(type === 'movie' ? 'title.director' : 'title.creators')}: ${d.directors.slice(0, 3).join(', ')}` : null,
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Hero media={media} backdrop={d.backdrop} lines={lines}>
        {d.score ? (
          <Txt v="caption" tone="faint">
            {t('title.score', { value: d.score.toFixed(1) })}
          </Txt>
        ) : null}
      </Hero>
      {d.tagline ? (
        <Txt v="small" tone="dim" style={styles.tagline}>
          {d.tagline}
        </Txt>
      ) : null}
      <ActionPanel media={media} />
      {d.overview || d.trailerKey ? (
        <Section>
          {d.overview ? <ExpandableText text={d.overview} /> : null}
          {d.trailerKey ? (
            <Button
              title={t('title.trailer')}
              icon="play-circle-outline"
              kind="secondary"
              small
              style={styles.trailer}
              onPress={() => WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${d.trailerKey}`)}
            />
          ) : null}
        </Section>
      ) : null}
      {type === 'tv' ? <Seasons details={d} media={media} seen={seen.data ?? []} /> : null}
      <CommunitySection media={media} />
      <FriendsSection media={media} />
      <WhereToWatch details={d} />
      <Soundtrack details={d} />
      {d.cast.length > 0 ? (
        <Section title={t('title.cast')}>
          <Txt tone="dim" style={styles.cast}>
            {d.cast.map((c) => c.name).join(' · ')}
          </Txt>
        </Section>
      ) : null}
      <ReviewsSection media={media} isSeasonUnseen={isSeasonUnseen} />
      {d.recommendations.length > 0 ? (
        <Section title={t('title.similar')} padded={false}>
          <MediaRow items={d.recommendations} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Seasons({ details, media, seen }: { details: FilmDetails; media: MediaSnapshot; seen: { season: number; episode: number }[] }) {
  const { t, date } = useI18n();
  const seasons = details.seasons.filter((s) => s.episodeCount > 0);
  if (seasons.length === 0) return null;
  const counts = seasons.map((s) => ({ season: s.season, episodeCount: s.episodeCount }));
  const aired = airedEpisodes(counts, details.lastEpisode);
  const watched = seenRegularCount(seen);
  const ordered = [...seasons.filter((s) => s.season > 0), ...seasons.filter((s) => s.season === 0)];

  return (
    <Section title={t('title.seasons')}>
      <View style={styles.progressHead}>
        <Txt v="smallStrong">{t('title.progress', { seen: watched, total: aired })}</Txt>
        {details.nextEpisode?.airDate ? (
          <Txt v="small" tone="accent">
            {t('title.nextEpisode', { date: date(details.nextEpisode.airDate) })}
          </Txt>
        ) : details.status ? (
          <Txt v="small" tone="faint">
            {details.status === 'Ended' || details.status === 'Canceled' ? t('title.ended') : t('title.returning')}
          </Txt>
        ) : null}
      </View>
      <ProgressBar value={aired ? watched / aired : 0} />
      <View style={styles.seasonList}>
        {ordered.map((s) => {
          const seenHere = seen.filter((e) => e.season === s.season).length;
          return (
            <Pressable
              key={s.season}
              style={({ pressed }) => [styles.season, { opacity: pressed ? 0.75 : 1 }]}
              onPress={() =>
                router.push({
                  pathname: '/season/[showId]/[season]',
                  params: { showId: details.id, season: String(s.season), media: mediaParam(media) },
                })
              }
            >
              <View style={styles.flex}>
                <Txt v="bodyStrong">{s.season === 0 ? t('title.specials') : t('title.seasonLabel', { n: s.season })}</Txt>
                <Txt v="small" tone="faint">
                  {[s.airDate ? s.airDate.slice(0, 4) : null, t('season.seen', { seen: seenHere, total: s.episodeCount })]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              </View>
              {seenHere >= s.episodeCount ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

function ProviderLogos({ list }: { list: Provider[] }) {
  return (
    <View style={styles.providers}>
      {list.slice(0, 8).map((p) => {
        const uri = imageUrl(p.logo, 'logo');
        return (
          <View key={p.id} style={styles.provider}>
            {uri ? <Image source={{ uri }} style={styles.providerLogo} /> : <View style={styles.providerLogo} />}
            <Txt v="caption" tone="dim" numberOfLines={1} style={styles.providerName}>
              {p.name}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

function WhereToWatch({ details }: { details: FilmDetails }) {
  const { t } = useI18n();
  const p = details.providers;
  if (!p) return null;
  const groups: [string, Provider[]][] = [
    [t('title.stream'), p.flatrate],
    [t('title.rent'), p.rent],
    [t('title.buy'), p.buy],
  ];
  return (
    <Section title={t('title.whereToWatch')}>
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([label, list]) => (
          <View key={label} style={styles.providerGroup}>
            <Txt v="caption" tone="faint">
              {label.toUpperCase()}
            </Txt>
            <ProviderLogos list={list} />
          </View>
        ))}
      <Pressable onPress={() => (p.link ? WebBrowser.openBrowserAsync(p.link) : undefined)} disabled={!p.link}>
        <Txt v="caption" tone="faint">
          {t('title.justwatch')}
        </Txt>
      </Pressable>
    </Section>
  );
}

function Soundtrack({ details }: { details: FilmDetails }) {
  const { t } = useI18n();
  const soundtracks = useSoundtracks(details.title, details.originalTitle);
  if (!soundtracks.data || soundtracks.data.length === 0) return null;
  return (
    <Section title={t('title.soundtrack')} padded={false}>
      <MediaRow items={soundtracks.data} width={130} />
    </Section>
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
  tagline: {
    marginHorizontal: gutter,
    marginTop: space.lg,
    fontStyle: 'italic',
  },
  trailer: {
    alignSelf: 'flex-start',
    marginTop: space.md,
  },
  cast: {
    lineHeight: 21,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
    gap: space.md,
  },
  seasonList: {
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  season: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  providerGroup: {
    gap: space.sm,
    marginBottom: space.md,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  provider: {
    width: 64,
    alignItems: 'center',
    gap: 4,
  },
  providerLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  providerName: {
    maxWidth: 64,
  },
});
