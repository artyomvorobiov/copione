import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, displayName, MediaListItem, Stars } from '@/components/media';
import { EmptyState, ErrorState, Loader, Section, Segmented, Txt } from '@/components/ui';
import { useProfile, useTastePairs } from '@/hooks/data';
import { type TKey, useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import { splitPairsByDomain, tasteMatch } from '@/lib/tasteMatch';
import type { Domain, TastePair } from '@/lib/types';
import { useBackend } from '@/state/session';
import { colors, domainColor, gutter, space } from '@/theme';

function verdict(score: number): TKey {
  if (score >= 80) return 'taste.verdict.high';
  if (score >= 60) return 'taste.verdict.good';
  if (score >= 40) return 'taste.verdict.mid';
  return 'taste.verdict.low';
}

export default function TasteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const backend = useBackend();
  const me = useProfile(backend.userId);
  const them = useProfile(id);
  const pairs = useTastePairs(id);
  const [domain, setDomain] = useState<Domain>('film');

  if (pairs.isLoading || them.isLoading || me.isLoading) return <Loader />;
  if (pairs.isError || !them.data || !me.data) return <ErrorState onRetry={() => pairs.refetch()} />;

  const result = tasteMatch(splitPairsByDomain(pairs.data ?? [])[domain]);
  const color = domainColor(domain);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Segmented
        value={domain}
        onChange={setDomain}
        style={styles.segment}
        options={[
          { value: 'film', label: t('domain.film') },
          { value: 'music', label: t('domain.music') },
        ]}
      />
      <View style={styles.hero}>
        <View style={styles.avatars}>
          <Avatar user={me.data} size={64} />
          <View style={[styles.score, { borderColor: color }]}>
            <Txt v="title" style={{ color }}>
              {result.score == null ? '—' : `${result.score}%`}
            </Txt>
          </View>
          <Avatar user={them.data} size={64} />
        </View>
        <Txt v="h2">{result.score == null ? t('taste.title') : t(verdict(result.score))}</Txt>
        <Txt v="small" tone="dim">
          {`${t('taste.with', { username: them.data.username })} · ${t('taste.common', { n: result.common })}`}
        </Txt>
      </View>

      {result.score == null ? <EmptyState icon="git-compare-outline" text={t('taste.notEnough')} /> : null}

      <PairList title={t('taste.bothLoved')} pairs={result.bothLoved.slice(0, 15)} themName={displayName(them.data)} />
      <PairList title={t('taste.disagree')} pairs={result.disagreements.slice(0, 15)} themName={displayName(them.data)} />
    </ScrollView>
  );
}

function PairList({ title, pairs, themName }: { title: string; pairs: TastePair[]; themName: string }) {
  const { t } = useI18n();
  if (pairs.length === 0) return null;
  return (
    <Section title={title}>
      {pairs.map((p) => (
        <MediaListItem
          key={mediaKey(p.media)}
          media={p.media}
          right={
            <View style={styles.ratings}>
              <View style={styles.ratingLine}>
                <Txt v="caption" tone="faint">
                  {t('common.you')}
                </Txt>
                <Stars value={p.mine} size={10} />
              </View>
              <View style={styles.ratingLine}>
                <Txt v="caption" tone="faint" numberOfLines={1} style={styles.name}>
                  {themName}
                </Txt>
                <Stars value={p.theirs} size={10} color={colors.music} />
              </View>
            </View>
          }
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
  },
  segment: {
    marginHorizontal: gutter,
    marginTop: space.md,
  },
  hero: {
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xxl,
    paddingHorizontal: gutter,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginBottom: space.md,
  },
  score: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratings: {
    alignItems: 'flex-end',
    gap: 4,
  },
  ratingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    maxWidth: 70,
  },
});
