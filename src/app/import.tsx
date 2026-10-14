import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, ProgressBar, Txt } from '@/components/ui';
import { useInvalidateUserData } from '@/hooks/data';
import { type TKey, useI18n } from '@/i18n';
import { todayISO } from '@/lib/dates';
import { type LetterboxdFile, parseLetterboxdCsv } from '@/lib/letterboxd';
import { mediaKey, toSnapshot } from '@/lib/media';
import { useCatalogs } from '@/state/catalogs';
import { useBackend } from '@/state/session';
import { colors, gutter, space } from '@/theme';

type Phase = 'idle' | 'reading' | 'running' | 'done';

async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

/** Imports a Letterboxd export (diary, ratings, reviews, watched, watchlist, likes). */
export default function ImportScreen() {
  const { t } = useI18n();
  const backend = useBackend();
  const { film, ctx } = useCatalogs();
  const invalidate = useInvalidateUserData();
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<(LetterboxdFile & { name: string }) | null>(null);
  const [done, setDone] = useState(0);
  const [added, setAdded] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const pick = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhase('reading');
    try {
      const parsed = parseLetterboxdCsv(await readPicked(asset), asset.name);
      if (!parsed || parsed.rows.length === 0) {
        setError(t('import.unknownFile'));
        setPhase('idle');
        return;
      }
      const loaded = { ...parsed, name: asset.name };
      setFile(loaded);
      await run(loaded);
    } catch {
      setError(t('import.unknownFile'));
      setPhase('idle');
    }
  };

  const run = async (f: LetterboxdFile & { name: string }) => {
    stop.current = false;
    setPhase('running');
    setDone(0);
    setAdded(0);
    setMissed([]);
    let index = 0;
    const worker = async () => {
      while (!stop.current && index < f.rows.length) {
        const row = f.rows[index++];
        try {
          const found = await film.findMovie(row.name, row.year, ctx);
          if (!found) {
            setMissed((m) => [...m, `${row.name}${row.year ? ` (${row.year})` : ''}`]);
          } else {
            const wantsDetails = f.kind === 'diary' || f.kind === 'reviews';
            const media = toSnapshot(wantsDetails ? await film.details('movie', found.id, ctx).catch(() => found) : found);
            if (f.kind === 'diary' || f.kind === 'reviews') {
              const day = row.watchedOn ?? todayISO();
              const sameDay = await backend.getEntriesBetween(backend.userId, day, day);
              if (!sameDay.some((e) => mediaKey(e.media) === mediaKey(media))) {
                await backend.addEntry({
                  media,
                  season: null,
                  watchedOn: day,
                  rating: row.rating,
                  liked: false,
                  rewatch: row.rewatch,
                  review: row.review,
                  spoilers: false,
                  vibes: [],
                });
              }
              await backend.setLibrary(media, { status: 'done', ...(row.rating != null ? { rating: row.rating } : {}) });
            } else if (f.kind === 'ratings') {
              await backend.setLibrary(media, { status: 'done', rating: row.rating });
            } else if (f.kind === 'watched') {
              await backend.setLibrary(media, { status: 'done' });
            } else if (f.kind === 'likes') {
              await backend.setLibrary(media, { status: 'done', liked: true });
            } else {
              const [existing] = await backend.getLibraryItems([media]);
              if (!existing?.status) await backend.setLibrary(media, { status: 'want' });
            }
            setAdded((n) => n + 1);
          }
        } catch {
          setMissed((m) => [...m, row.name]);
        }
        setDone((n) => n + 1);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await invalidate();
    setPhase('done');
  };

  const total = file?.rows.length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Txt v="h3">{t('import.how')}</Txt>
        {(['import.step1', 'import.step2', 'import.step3'] as TKey[]).map((key, i) => (
          <View key={key} style={styles.step}>
            <Txt v="smallStrong" tone="accent">{`${i + 1}`}</Txt>
            <Txt v="small" tone="dim" style={styles.flex}>
              {t(key)}
            </Txt>
          </View>
        ))}
      </Card>

      {!film.live ? (
        <Txt v="small" tone="danger" style={styles.warning}>
          {t('import.needsTmdb')}
        </Txt>
      ) : null}

      {phase === 'idle' || phase === 'done' ? (
        <Button title={t('import.pick')} icon="document-attach-outline" onPress={pick} style={styles.button} />
      ) : null}
      {phase === 'reading' ? <Txt tone="dim">{t('import.reading')}</Txt> : null}
      {error ? (
        <Txt v="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {file && phase !== 'idle' ? (
        <Card style={styles.card}>
          <Txt v="small" tone="dim">
            {t('import.file', { name: file.name, kind: t(`import.kind.${file.kind}` as TKey), n: total })}
          </Txt>
          <ProgressBar value={total ? done / total : 0} height={8} />
          <Txt v="smallStrong">{t('import.progress', { done, total })}</Txt>
          {phase === 'running' ? (
            <Button title={t('import.stop')} kind="secondary" small onPress={() => (stop.current = true)} />
          ) : null}
          {phase === 'done' ? (
            <Txt v="bodyStrong" tone="success">
              {t('import.done', { added, missed: missed.length })}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      {phase === 'done' && missed.length > 0 ? (
        <Card style={styles.card}>
          <Txt v="smallStrong">{t('import.missed')}</Txt>
          {missed.slice(0, 100).map((m, i) => (
            <Txt key={`${m}-${i}`} v="small" tone="dim">
              {m}
            </Txt>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: gutter,
    paddingBottom: 60,
    gap: space.lg,
  },
  card: {
    gap: space.md,
  },
  step: {
    flexDirection: 'row',
    gap: space.md,
  },
  warning: {
    color: colors.danger,
  },
  button: {
    alignSelf: 'stretch',
  },
});
