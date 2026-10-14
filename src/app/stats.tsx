import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MonthBars, TopList } from '@/components/charts';
import { RatingHistogram } from '@/components/entry';
import { Button, Card, Chip, ChipRow, EmptyState, ErrorState, IconButton, Loader, ProgressBar, Section, Segmented, Txt } from '@/components/ui';
import { useProfile, useYearData } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { formatRating } from '@/lib/rating';
import { activeYears, computeStats, type CountItem } from '@/lib/stats';
import type { Domain } from '@/lib/types';
import { useBackend } from '@/state/session';
import { colors, domainColor, gutter, space } from '@/theme';

export default function StatsScreen() {
  const params = useLocalSearchParams<{ user?: string }>();
  const backend = useBackend();
  const userId = params.user || backend.userId;
  const { t, monthShort, genre } = useI18n();
  const profile = useProfile(userId);
  const data = useYearData(userId, null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number | null>(currentYear);
  const [domain, setDomain] = useState<Domain>('film');

  const years = useMemo(() => activeYears(data.data?.entries ?? [], currentYear), [data.data, currentYear]);
  const stats = useMemo(
    () => (data.data ? computeStats(data.data.entries, data.data.episodes, year) : null),
    [data.data, year],
  );

  if (data.isLoading || profile.isLoading) return <Loader />;
  if (data.isError || !stats) return <ErrorState onRetry={() => data.refetch()} />;

  const color = domainColor(domain);
  const s = domain === 'film' ? stats.film : stats.music;
  const isMe = userId === backend.userId;
  const goal = domain === 'film' ? profile.data?.goalFilms : profile.data?.goalAlbums;
  const goalDone = domain === 'film' ? stats.film.movies : stats.music.albums;
  const named = (items: CountItem[]) =>
    items.map((i) => ({ ...i, name: genre(domain === 'film' ? 'movie' : 'album', i.name) ?? i.name }));
  const big =
    domain === 'film'
      ? [
          [t('stats.films'), stats.film.movies],
          [t('stats.episodes'), stats.film.episodes],
          [t('stats.hours'), Math.round(stats.film.minutes / 60)],
          [t('stats.avg'), stats.film.avgRating != null ? formatRating(Math.round(stats.film.avgRating * 10) / 10) : '—'],
        ]
      : [
          [t('stats.albums'), stats.music.albums],
          [t('stats.tracks'), stats.music.tracks],
          [t('stats.hours'), Math.round(stats.music.minutes / 60)],
          [t('stats.avg'), stats.music.avgRating != null ? formatRating(Math.round(stats.music.avgRating * 10) / 10) : '—'],
        ];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            !isMe ? null : (
            <IconButton
              name="images-outline"
              label={t('stats.share')}
              onPress={() => router.push({ pathname: '/share', params: { stats: String(year ?? 'all'), user: userId, domain } })}
            />
            ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ChipRow style={styles.years}>
          {years.map((y) => (
            <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
          ))}
          <Chip label={t('stats.allTime')} selected={year == null} onPress={() => setYear(null)} />
        </ChipRow>
        <Segmented
          value={domain}
          onChange={setDomain}
          style={styles.segment}
          options={[
            { value: 'film', label: t('domain.film') },
            { value: 'music', label: t('domain.music') },
          ]}
        />

        <View style={styles.grid}>
          {big.map(([label, value]) => (
            <Card key={String(label)} style={styles.tile}>
              <Txt v="hero" style={{ color }}>
                {String(value)}
              </Txt>
              <Txt v="caption" tone="faint">
                {String(label).toUpperCase()}
              </Txt>
            </Card>
          ))}
        </View>

        {year === currentYear && (goal || isMe) ? (
          <Section title={t(domain === 'film' ? 'stats.goal.film' : 'stats.goal.music')}>
            {goal ? (
              <View style={styles.goal}>
                <ProgressBar value={goalDone / goal} color={color} height={10} />
                <Txt v="smallStrong" tone="dim">
                  {t('stats.goalProgress', { done: goalDone, goal })}
                </Txt>
              </View>
            ) : (
              <Button title={t('stats.setGoal')} kind="secondary" small onPress={() => router.push('/edit-profile')} style={styles.left} />
            )}
          </Section>
        ) : null}

        {s.entries === 0 ? (
          <EmptyState icon="stats-chart-outline" text={t('stats.empty')} />
        ) : (
          <>
            {year != null ? (
              <Section title={t('stats.byMonth')}>
                <MonthBars values={s.byMonth} labels={s.byMonth.map((_, i) => monthShort(i).slice(0, 1).toUpperCase())} color={color} />
              </Section>
            ) : null}
            <Section title={t('stats.ratings')}>
              <RatingHistogram histogram={s.histogram} color={color} height={70} />
            </Section>
            {s.topGenres.length ? (
              <Section title={t('stats.topGenres')}>
                <TopList items={named(s.topGenres)} color={color} />
              </Section>
            ) : null}
            {s.topCreators.length ? (
              <Section title={t(domain === 'film' ? 'stats.topDirectors' : 'stats.topArtists')}>
                <TopList items={s.topCreators} color={color} />
              </Section>
            ) : null}
            <Section>
              <Txt v="small" tone="faint">
                {`${t('stats.reviews')}: ${s.reviews} · ♥ ${s.liked}`}
              </Txt>
            </Section>
          </>
        )}
        {isMe ? (
          <Button
            title={t('stats.share')}
            icon="share-outline"
            kind="secondary"
            style={styles.share}
            onPress={() => router.push({ pathname: '/share', params: { stats: String(year ?? 'all'), user: userId, domain } })}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: space.md,
    paddingBottom: 60,
  },
  years: {
    paddingBottom: space.md,
  },
  segment: {
    marginHorizontal: gutter,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingHorizontal: gutter,
    marginTop: space.lg,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    gap: 2,
    paddingVertical: space.lg,
  },
  goal: {
    gap: space.sm,
  },
  left: {
    alignSelf: 'flex-start',
  },
  share: {
    marginHorizontal: gutter,
    marginTop: space.xxl,
  },
  muted: {
    color: colors.textFaint,
  },
});
