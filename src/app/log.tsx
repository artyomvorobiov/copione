import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { vibeLabel } from '@/components/entry';
import { goBack, parseMediaParam, Poster, StarInput } from '@/components/media';
import { Button, Chip, ErrorState, GroupTitle, Loader, Txt } from '@/components/ui';
import { errorMessage, useEntry, useFilmDetails, useInvalidateUserData, useLibraryItem } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { todayISO } from '@/lib/dates';
import { domainOf, type EntryCard, type EntryInput, type LibraryItem, type MediaSnapshot } from '@/lib/types';
import { MAX_VIBES, sanitizeVibes, vibesFor } from '@/lib/vibes';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { colors, domainColor, font, gutter, radius, space } from '@/theme';

/** Log a watch/listen with rating, vibes and an optional review (modal). */
export default function LogScreen() {
  const params = useLocalSearchParams<{ media?: string; entryId?: string }>();
  const entry = useEntry(params.entryId ?? '', !!params.entryId);
  const fromParam = useMemo(() => parseMediaParam(params.media), [params.media]);
  const media = fromParam ?? entry.data?.media ?? null;

  if (params.entryId && entry.isLoading) return <Loader />;
  if (!media) return <ErrorState />;
  return <LogLoader key={params.entryId ?? 'new'} media={media} existing={params.entryId ? entry.data ?? null : null} />;
}

/** Waits for the library state so a new entry starts with the current rating and like. */
function LogLoader({ media, existing }: { media: MediaSnapshot; existing: EntryCard | null }) {
  const library = useLibraryItem(media);
  if (!existing && !library.isFetched && !library.isError) return <Loader />;
  return <LogForm media={media} existing={existing} library={library.item} />;
}

function LogForm({
  media,
  existing,
  library,
}: {
  media: MediaSnapshot;
  existing: EntryCard | null;
  library: LibraryItem | null;
}) {
  const { t } = useI18n();
  const backend = useBackend();
  const invalidate = useInvalidateUserData();
  const toast = useToast();
  const domain = domainOf(media.type);
  const accent = domainColor(domain);
  const details = useFilmDetails('tv', media.id, media.type === 'tv');

  const [watchedOn, setWatchedOn] = useState(existing?.watchedOn ?? todayISO());
  const [rating, setRating] = useState<number | null>(existing ? existing.rating : library?.rating ?? null);
  const [liked, setLiked] = useState(existing ? existing.liked : !!library?.liked);
  const [rewatch, setRewatch] = useState(existing?.rewatch ?? false);
  const [season, setSeason] = useState<number | null>(existing?.season ?? null);
  const [vibes, setVibes] = useState<string[]>(existing?.vibes ?? []);
  const [review, setReview] = useState(existing?.review ?? '');
  const [spoilers, setSpoilers] = useState(existing?.spoilers ?? false);
  const [saving, setSaving] = useState(false);

  const seasons = (details.data?.seasons ?? []).filter((s) => s.season > 0 && s.episodeCount > 0);

  const toggleVibe = (id: string) => {
    setVibes((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : prev.length >= MAX_VIBES ? prev : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    const input: EntryInput = {
      media,
      season: media.type === 'tv' ? season : null,
      watchedOn,
      rating,
      liked,
      rewatch,
      review: review.trim() || null,
      spoilers,
      vibes: sanitizeVibes(vibes, domain),
    };
    try {
      if (existing) await backend.updateEntry(existing.id, input);
      else await backend.addEntry(input);
      await backend.setLibrary(media, { status: 'done', liked, ...(rating != null ? { rating } : {}) });
      await invalidate();
      toast(t('log.saved'));
      goBack();
    } catch (err) {
      Alert.alert(t('error.title'), errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('log.delete'), t('log.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await backend.deleteEntry(existing.id);
            await invalidate();
            router.dismissAll();
          } catch (err) {
            Alert.alert(t('error.title'), errorMessage(err, t));
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: existing ? t('log.editTitle') : t('log.title'),
          headerLeft: () => <Button title={t('common.cancel')} kind="ghost" small onPress={() => goBack()} />,
          headerRight: () => <Button title={t('common.save')} small onPress={save} loading={saving} color={accent} />,
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Poster media={media} width={media.type === 'album' || media.type === 'track' ? 72 : 60} size="thumb" />
            <View style={styles.flex}>
              <Txt v="h2" numberOfLines={2}>
                {media.title}
              </Txt>
              <Txt v="small" tone="dim">
                {[media.subtitle, media.year].filter(Boolean).join(' · ')}
              </Txt>
            </View>
          </View>

          <GroupTitle>{t('log.date')}</GroupTitle>
          <DateField value={watchedOn} onChange={(v) => setWatchedOn(v)} />

          <GroupTitle>{t('log.rating')}</GroupTitle>
          <View style={styles.ratingRow}>
            <StarInput
              value={rating}
              onChange={setRating}
              size={40}
            />
            <Pressable
              onPress={() => setLiked((v) => !v)}
              hitSlop={10}
              accessibilityRole="switch"
              accessibilityState={{ checked: liked }}
              accessibilityLabel={t('log.liked')}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={34} color={liked ? colors.like : colors.textFaint} />
            </Pressable>
          </View>
          <Txt v="caption" tone="faint" style={styles.hint}>
            {t('log.ratingHint')}
          </Txt>

          <View style={styles.switchRow}>
            <Txt>{t(domain === 'film' ? 'log.rewatch.film' : 'log.rewatch.music')}</Txt>
            <Switch value={rewatch} onValueChange={setRewatch} trackColor={{ true: accent, false: colors.surface3 }} />
          </View>

          {media.type === 'tv' && seasons.length > 0 ? (
            <>
              <GroupTitle>{t('log.season')}</GroupTitle>
              <View style={styles.wrapRow}>
                <Chip label={t('log.wholeShow')} selected={season == null} onPress={() => setSeason(null)} />
                {seasons.map((s) => (
                  <Chip
                    key={s.season}
                    label={t('title.seasonLabel', { n: s.season })}
                    selected={season === s.season}
                    onPress={() => setSeason(s.season)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <GroupTitle>{t('log.vibes')}</GroupTitle>
          <View style={styles.wrapRow}>
            {vibesFor(domain).map((v) => (
              <Chip
                key={v.id}
                icon={v.emoji}
                label={vibeLabel(t, v.id)}
                selected={vibes.includes(v.id)}
                color={accent}
                onPress={() => toggleVibe(v.id)}
              />
            ))}
          </View>

          <GroupTitle>{t('log.review')}</GroupTitle>
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder={t('log.reviewPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={8000}
            style={styles.review}
          />
          {review.trim() ? (
            <View style={styles.switchRow}>
              <Txt>{t('log.spoilers')}</Txt>
              <Switch value={spoilers} onValueChange={setSpoilers} trackColor={{ true: colors.danger, false: colors.surface3 }} />
            </View>
          ) : null}
          {review.length > 7000 ? (
            <Txt v="caption" tone="faint">{`${review.length} / 8000`}</Txt>
          ) : null}

          <Button title={t('common.save')} onPress={save} loading={saving} color={accent} style={styles.save} />
          {existing ? <Button title={t('log.delete')} kind="danger" onPress={remove} style={styles.delete} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: gutter,
    paddingBottom: 80,
  },
  head: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    marginTop: space.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  review: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  save: {
    marginTop: space.xxl,
  },
  delete: {
    marginTop: space.md,
  },
});
