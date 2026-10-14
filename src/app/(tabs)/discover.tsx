import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen, TabHeader, useBottomInset } from '@/components/layout';
import { Avatar, displayName, MediaCard, MediaListItem, MediaRow, openUser } from '@/components/media';
import { SearchBar } from '@/components/SearchBar';
import { Chip, ChipRow, EmptyState, ErrorState, Loader, Section, Segmented, Txt } from '@/components/ui';
import { config } from '@/config';
import {
  useFilmSearch,
  useMoodPicks,
  useMusicCharts,
  useMusicSearch,
  useProfileSearch,
  useSuggestedProfiles,
  useTrending,
} from '@/hooks/data';
import { useDebounced } from '@/hooks/useDebounced';
import { type TKey, useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import { MOODS } from '@/lib/moods';
import type { ProfileLite } from '@/lib/types';
import { useCatalogs } from '@/state/catalogs';
import { colors, gutter, radius, space } from '@/theme';

type Tab = 'film' | 'music' | 'people';

function asTab(value: string | undefined): Tab | null {
  return value === 'film' || value === 'music' || value === 'people' ? value : null;
}

export default function DiscoverScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() => asTab(params.tab) ?? 'film');
  const [tabParam, setTabParam] = useState(params.tab);
  if (params.tab !== tabParam) {
    // "Find people" on the feed opens this tab with ?tab=people.
    setTabParam(params.tab);
    const next = asTab(params.tab);
    if (next) setTab(next);
  }
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 450);
  const bottom = useBottomInset();

  const placeholder: TKey =
    tab === 'film' ? 'discover.placeholderFilm' : tab === 'music' ? 'discover.placeholderMusic' : 'discover.placeholderPeople';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TabHeader title={t('discover.title')}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t(placeholder)} />
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'film', label: t('discover.segFilm') },
              { value: 'music', label: t('discover.segMusic') },
              { value: 'people', label: t('discover.segPeople') },
            ]}
          />
        </TabHeader>
        {tab === 'film' ? q.length >= 2 ? <FilmResults query={q} /> : <FilmHome /> : null}
        {tab === 'music' ? q.length >= 2 ? <MusicResults query={q} /> : <MusicHome /> : null}
        {tab === 'people' ? <People query={q} /> : null}
      </ScrollView>
    </Screen>
  );
}

function DemoNote({ text }: { text: string }) {
  return (
    <Txt v="small" tone="faint" style={styles.note}>
      {text}
    </Txt>
  );
}

/* Film ------------------------------------------------------------------- */

function FilmHome() {
  const { t } = useI18n();
  const { film } = useCatalogs();
  const [mood, setMood] = useState<string | null>(null);
  const [moodType, setMoodType] = useState<'movie' | 'tv'>('movie');
  const picks = useMoodPicks(mood, moodType);
  const movies = useTrending('movie');
  const series = useTrending('tv');

  return (
    <View>
      {!film.live ? <DemoNote text={t('discover.filmDemo')} /> : null}
      <Section title={t('discover.moods')} padded={false}>
        <ChipRow>
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              icon={m.emoji}
              label={t(`mood.${m.id}` as TKey)}
              selected={mood === m.id}
              onPress={() => setMood(mood === m.id ? null : m.id)}
            />
          ))}
        </ChipRow>
        {mood ? (
          <View style={styles.moodBlock}>
            <View style={styles.moodToggle}>
              <Chip label={t('discover.movies')} selected={moodType === 'movie'} onPress={() => setMoodType('movie')} />
              <Chip label={t('discover.series')} selected={moodType === 'tv'} onPress={() => setMoodType('tv')} />
            </View>
            {picks.isLoading ? (
              <Loader />
            ) : picks.isError ? (
              <ErrorState onRetry={() => picks.refetch()} />
            ) : (picks.data ?? []).length === 0 ? (
              <EmptyState icon="search-outline" text={t('discover.noResults')} />
            ) : (
              <MediaRow items={picks.data!} />
            )}
          </View>
        ) : null}
      </Section>
      <Section title={t('discover.trendingMovies')} padded={false}>
        {movies.isLoading ? <Loader /> : movies.isError ? <ErrorState onRetry={() => movies.refetch()} /> : <MediaRow items={movies.data ?? []} />}
      </Section>
      <Section title={t('discover.trendingTv')} padded={false}>
        {series.isLoading ? <Loader /> : series.isError ? <ErrorState onRetry={() => series.refetch()} /> : <MediaRow items={series.data ?? []} />}
      </Section>
    </View>
  );
}

function FilmResults({ query }: { query: string }) {
  const { t } = useI18n();
  const results = useFilmSearch(query);
  if (results.isLoading) return <Loader />;
  if (results.isError) return <ErrorState onRetry={() => results.refetch()} />;
  if ((results.data ?? []).length === 0) return <EmptyState icon="search-outline" text={t('discover.noResults')} />;
  return (
    <View style={styles.list}>
      {results.data!.map((m) => (
        <MediaListItem key={mediaKey(m)} media={m} />
      ))}
    </View>
  );
}

/* Music ------------------------------------------------------------------ */

function MusicHome() {
  const { t } = useI18n();
  const albums = useMusicCharts('albums');
  const songs = useMusicCharts('songs');
  return (
    <View>
      {!config.liveMusic ? <DemoNote text={t('discover.musicDemo')} /> : null}
      <Section title={t('discover.chartAlbums')} padded={false}>
        {albums.isLoading ? <Loader /> : albums.isError ? <ErrorState onRetry={() => albums.refetch()} /> : <MediaRow items={albums.data ?? []} width={130} />}
      </Section>
      <Section title={t('discover.chartSongs')}>
        {songs.isLoading ? (
          <Loader />
        ) : songs.isError ? (
          <ErrorState onRetry={() => songs.refetch()} />
        ) : (
          (songs.data ?? []).slice(0, 15).map((s, i) => (
            <View key={mediaKey(s)} style={styles.ranked}>
              <Txt v="h3" tone="faint" style={styles.rank}>
                {i + 1}
              </Txt>
              <View style={styles.flex}>
                <MediaListItem media={s} />
              </View>
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

function MusicResults({ query }: { query: string }) {
  const { t } = useI18n();
  const results = useMusicSearch(query);
  if (results.isLoading) return <Loader />;
  if (results.isError) return <ErrorState onRetry={() => results.refetch()} />;
  const data = results.data!;
  if (data.albums.length + data.tracks.length + data.artists.length === 0) {
    return <EmptyState icon="search-outline" text={t('discover.noResults')} />;
  }
  return (
    <View>
      {data.artists.length > 0 ? (
        <Section title={t('discover.artists')} padded={false}>
          <ChipRow>
            {data.artists.map((a) => (
              <Chip key={a.id} label={a.name} icon="🎤" onPress={() => router.push({ pathname: '/artist/[id]', params: { id: a.id } })} />
            ))}
          </ChipRow>
        </Section>
      ) : null}
      {data.albums.length > 0 ? (
        <Section title={t('discover.albums')} padded={false}>
          <View style={styles.albumGrid}>
            {data.albums.slice(0, 12).map((a) => (
              <MediaCard key={mediaKey(a)} media={a} width={104} />
            ))}
          </View>
        </Section>
      ) : null}
      {data.tracks.length > 0 ? (
        <Section title={t('discover.tracks')}>
          {data.tracks.map((tr) => (
            <MediaListItem key={mediaKey(tr)} media={tr} />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

/* People ----------------------------------------------------------------- */

function PersonRow({ person }: { person: ProfileLite }) {
  return (
    <Pressable style={styles.person} onPress={() => openUser(person.id)}>
      <Avatar user={person} size={42} />
      <View style={styles.flex}>
        <Txt v="bodyStrong">{displayName(person)}</Txt>
        <Txt v="small" tone="faint">{`@${person.username}`}</Txt>
      </View>
    </Pressable>
  );
}

function People({ query }: { query: string }) {
  const { t } = useI18n();
  const results = useProfileSearch(query);
  const suggested = useSuggestedProfiles();
  if (!query) {
    return (
      <Section title={t('feed.suggested')}>
        <Txt v="small" tone="faint" style={styles.peopleHint}>
          {t('discover.peopleHint')}
        </Txt>
        {suggested.isLoading ? <Loader /> : (suggested.data ?? []).map((p) => <PersonRow key={p.id} person={p} />)}
      </Section>
    );
  }
  if (results.isLoading) return <Loader />;
  if (results.isError) return <ErrorState onRetry={() => results.refetch()} />;
  if ((results.data ?? []).length === 0) return <EmptyState icon="person-outline" text={t('discover.noResults')} />;
  return (
    <View style={styles.list}>
      {results.data!.map((p) => (
        <PersonRow key={p.id} person={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  note: {
    marginHorizontal: gutter,
    marginTop: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  moodBlock: {
    marginTop: space.lg,
    gap: space.md,
  },
  moodToggle: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: gutter,
  },
  list: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
  },
  ranked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rank: {
    width: 26,
    textAlign: 'center',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingHorizontal: gutter,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  peopleHint: {
    marginBottom: space.sm,
  },
});
