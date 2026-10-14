import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, GroupTitle, SwitchRow, Txt } from '@/components/ui';
import { errorMessage, useInvalidateUserData } from '@/hooks/data';
import { type TKey, useI18n } from '@/i18n';
import { buildDeck } from '@/lib/deck';
import { mediaKey } from '@/lib/media';
import { moodById, MOODS } from '@/lib/moods';
import { randomId } from '@/lib/random';
import type { MatchKind, MediaSummary } from '@/lib/types';
import { useCatalogs } from '@/state/catalogs';
import { useBackend } from '@/state/session';
import { gutter, space } from '@/theme';

const KINDS: MatchKind[] = ['movie', 'tv', 'mixed', 'music'];

/** Options for a new Match room; builds the shared deck and creates the room. */
export default function MatchNewScreen() {
  const { t } = useI18n();
  const backend = useBackend();
  const { film, music, ctx } = useCatalogs();
  const invalidate = useInvalidateUserData();
  const [kind, setKind] = useState<MatchKind>('movie');
  const [mood, setMood] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState(true);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const domain = kind === 'music' ? 'music' : 'film';
      const [seen, want] = await Promise.all([
        backend.getUserLibrary(backend.userId, 'done', domain),
        watchlist ? backend.getUserLibrary(backend.userId, 'want', domain) : Promise.resolve([]),
      ]);
      const sources: MediaSummary[][] = [];
      const m = mood ? moodById(mood) : undefined;
      const types: ('movie' | 'tv')[] = kind === 'mixed' ? ['movie', 'tv'] : kind === 'tv' ? ['tv'] : kind === 'movie' ? ['movie'] : [];
      for (const type of types) {
        if (m) {
          const [p1, p2] = await Promise.all([
            film.discover(type, m[type], m.without ?? [], ctx, 1),
            film.discover(type, m[type], m.without ?? [], ctx, 2).catch(() => []),
          ]);
          sources.push(p1, p2);
        } else {
          sources.push(await film.trending(type, ctx));
          sources.push(await film.discover(type, [], [], ctx, 1).catch(() => []));
        }
      }
      if (kind === 'music') sources.push(await music.charts('albums', ctx));
      const wanted = want.map((w) => w.media).filter((x) => kind === 'mixed' || kind === 'music' || x.type === kind);
      sources.unshift(wanted);

      const deck = buildDeck(sources, { exclude: new Set(seen.map((s) => mediaKey(s.media))), seed: randomId() });
      if (deck.length === 0) {
        Alert.alert(t('match.create'), t('match.deckEmpty'));
        return;
      }
      const room = await backend.createRoom(kind, deck);
      await invalidate();
      router.replace({ pathname: '/match/[id]', params: { id: room.id } });
    } catch (err) {
      Alert.alert(t('error.title'), errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GroupTitle>{t('match.kind')}</GroupTitle>
      <View style={styles.wrap}>
        {KINDS.map((k) => (
          <Chip key={k} label={t(`match.kind.${k}` as TKey)} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      {kind !== 'music' ? (
        <>
          <GroupTitle>{t('match.mood')}</GroupTitle>
          <View style={styles.wrap}>
            <Chip label={t('match.anyMood')} selected={!mood} onPress={() => setMood(null)} />
            {MOODS.map((md) => (
              <Chip key={md.id} icon={md.emoji} label={t(`mood.${md.id}` as TKey)} selected={mood === md.id} onPress={() => setMood(md.id)} />
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.switch}>
        <SwitchRow label={t('match.includeWatchlist')} value={watchlist} onChange={setWatchlist} icon="time-outline" />
      </View>
      <Button title={busy ? t('match.creating') : t('match.create')} onPress={create} loading={busy} style={styles.create} />
      <Txt v="small" tone="faint" style={styles.hint}>
        {t('match.hint')}
      </Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: gutter,
    paddingBottom: 60,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  switch: {
    marginTop: space.xl,
    marginHorizontal: -space.lg,
  },
  create: {
    marginTop: space.xl,
  },
  hint: {
    textAlign: 'center',
    marginTop: space.md,
  },
});
