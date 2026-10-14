import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { goBack, MediaListItem, Poster } from '@/components/media';
import { SearchBar } from '@/components/SearchBar';
import { Button, EmptyState, Loader, Txt } from '@/components/ui';
import { useAction, useFilmSearch, useMusicSearch, useProfile, useUserLibrary } from '@/hooks/data';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { mediaKey, toSnapshot } from '@/lib/media';
import type { MediaSnapshot, MediaSummary } from '@/lib/types';
import { useBackend } from '@/state/session';
import { colors, gutter, space } from '@/theme';

/** Choose up to four favorite films/series or albums for the profile. */
export default function PickFavoritesScreen() {
  const params = useLocalSearchParams<{ domain?: string }>();
  const domain = params.domain === 'music' ? 'music' : 'film';
  const backend = useBackend();
  const profile = useProfile(backend.userId);
  if (!profile.data) return <Loader />;
  return <Picker domain={domain} initial={domain === 'film' ? profile.data.favFilms : profile.data.favMusic} />;
}

function Picker({ domain, initial }: { domain: 'film' | 'music'; initial: MediaSnapshot[] }) {
  const { t } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const rated = useUserLibrary(backend.userId, 'done', domain);
  const [selected, setSelected] = useState<MediaSnapshot[]>(initial);
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 450);
  const films = useFilmSearch(domain === 'film' ? q : '');
  const music = useMusicSearch(domain === 'music' ? q : '');

  const candidates: MediaSummary[] = useMemo(() => {
    if (q.length >= 2) return domain === 'film' ? films.data ?? [] : music.data?.albums ?? [];
    // Highest-rated titles from the library first.
    return [...(rated.data ?? [])]
      .filter((l) => domain === 'film' || l.media.type === 'album')
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((l) => l.media);
  }, [q, domain, films.data, music.data, rated.data]);

  const keys = new Set(selected.map(mediaKey));

  const toggle = (m: MediaSummary) => {
    const key = mediaKey(m);
    if (keys.has(key)) setSelected(selected.filter((s) => mediaKey(s) !== key));
    else if (selected.length < 4) setSelected([...selected, toSnapshot(m)]);
  };

  const save = async () => {
    const ok = await act(() => backend.updateProfile(domain === 'film' ? { favFilms: selected } : { favMusic: selected }));
    if (ok) goBack();
  };

  const loading = q.length >= 2 && (domain === 'film' ? films.isLoading : music.isLoading);

  return (
    <>
      <Stack.Screen
        options={{
          title: t(domain === 'film' ? 'pick.titleFilm' : 'pick.titleMusic'),
          headerRight: () => <Button title={t('common.done')} small onPress={save} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.selected}>
          {[0, 1, 2, 3].map((i) => {
            const m = selected[i];
            return m ? (
              <Pressable key={mediaKey(m)} onPress={() => toggle(m)}>
                <Poster media={m} width={72} size="thumb" />
                <View style={styles.remove}>
                  <Ionicons name="close-circle" size={20} color={colors.white} />
                </View>
              </Pressable>
            ) : (
              <View key={i} style={[styles.slot, domain === 'music' && styles.slotSquare]} />
            );
          })}
        </View>
        <Txt v="small" tone="faint" style={styles.center}>
          {t('pick.selected', { n: selected.length })}
        </Txt>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('pick.placeholder')} style={styles.search} />
        {loading ? (
          <Loader />
        ) : candidates.length === 0 ? (
          <EmptyState icon="search-outline" text={t('discover.noResults')} />
        ) : (
          candidates.slice(0, 40).map((m) => (
            <MediaListItem
              key={mediaKey(m)}
              media={m}
              onPress={() => toggle(m)}
              right={
                <Ionicons
                  name={keys.has(mediaKey(m)) ? 'checkmark-circle' : 'add-circle-outline'}
                  size={24}
                  color={keys.has(mediaKey(m)) ? colors.success : colors.textDim}
                />
              }
            />
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: gutter,
    paddingBottom: 60,
  },
  selected: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
  },
  slot: {
    width: 72,
    height: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  slotSquare: {
    height: 72,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  center: {
    textAlign: 'center',
    marginTop: space.sm,
  },
  search: {
    marginVertical: space.lg,
  },
});
