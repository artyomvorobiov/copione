import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { EntryCard, RatingHistogram, VibeSummary } from '@/components/entry';
import { Avatar, displayName, mediaParam, openUser, StarInput, Stars } from '@/components/media';
import { Button, Card, EmptyState, Section, ToggleTile, Txt } from '@/components/ui';
import { config } from '@/config';
import { useFriendsOn, useLibraryItem, useLibraryMutation, useMediaEntries, useTitleStats } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { domainOf, type MediaSnapshot } from '@/lib/types';
import { formatRating } from '@/lib/rating';
import { useSettings } from '@/state/settings';
import { colors, domainColor, gutter, radius, space } from '@/theme';

function haptic() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Watched / like / watchlist toggles, the star rating and the log button. */
export function ActionPanel({ media }: { media: MediaSnapshot }) {
  const { t } = useI18n();
  const { item } = useLibraryItem(media);
  const mutate = useLibraryMutation(media);
  const domain = domainOf(media.type);
  const accent = domainColor(domain);
  const done = item?.status === 'done';
  const want = item?.status === 'want';
  const liked = !!item?.liked;

  const share = () => {
    const message = t('share.titleText', { title: media.title, year: media.year ?? '', app: config.appName }).replace(' ()', '');
    Share.share({ message }).catch(() => {});
  };

  return (
    <Card style={styles.panel}>
      <View style={styles.toggles}>
        <ToggleTile
          icon={domain === 'film' ? 'eye-outline' : 'headset-outline'}
          activeIcon={domain === 'film' ? 'eye' : 'headset'}
          label={t(domain === 'film' ? 'title.done.film' : 'title.done.music')}
          active={done}
          activeColor={colors.success}
          onPress={() => {
            haptic();
            mutate({ status: done ? null : 'done' });
          }}
        />
        <ToggleTile
          icon="heart-outline"
          activeIcon="heart"
          label={t('title.like')}
          active={liked}
          activeColor={colors.like}
          onPress={() => {
            haptic();
            mutate(liked ? { liked: false } : { liked: true, status: item?.status === 'want' || !item?.status ? 'done' : item.status });
          }}
        />
        <ToggleTile
          icon="time-outline"
          activeIcon="time"
          label={t(domain === 'film' ? 'title.want.film' : 'title.want.music')}
          active={want}
          activeColor={accent}
          onPress={() => {
            haptic();
            mutate({ status: want ? null : 'want' });
          }}
        />
      </View>
      <View style={styles.rating}>
        <Txt v="caption" tone="faint">
          {(item?.rating ? t('title.yourRating') : t('title.tapToRate')).toUpperCase()}
        </Txt>
        <StarInput value={item?.rating ?? null} onChange={(rating) => mutate(rating == null ? { rating: null } : { rating, status: 'done' })} />
      </View>
      <View style={styles.buttons}>
        <Button
          title={t('title.logReview')}
          icon="create-outline"
          color={accent}
          style={styles.flex}
          onPress={() => router.push({ pathname: '/log', params: { media: mediaParam(media) } })}
        />
      </View>
      <View style={styles.secondary}>
        <Button
          title={t('title.addToList')}
          icon="list-outline"
          kind="secondary"
          small
          style={styles.flex}
          onPress={() => router.push({ pathname: '/add-to-list', params: { media: mediaParam(media) } })}
        />
        <Button title={t('common.share')} icon="share-outline" kind="secondary" small style={styles.flex} onPress={share} />
      </View>
    </Card>
  );
}

/** Community average (hidden in blind mode until you rate), histogram and vibes. */
export function CommunitySection({ media }: { media: MediaSnapshot }) {
  const { t, plural } = useI18n();
  const { settings } = useSettings();
  const stats = useTitleStats(media);
  const { item } = useLibraryItem(media);
  const [revealed, setRevealed] = useState(false);
  const s = stats.data;
  if (!s) return null;
  const blind = settings.blindRatings && item?.rating == null && !revealed && s.count > 0;
  const color = domainColor(domainOf(media.type));

  return (
    <>
      <Section title={t('title.community')}>
        {s.count === 0 ? (
          <Txt tone="dim">{t('title.noRatings')}</Txt>
        ) : blind ? (
          <Pressable style={styles.blind} onPress={() => setRevealed(true)} accessibilityRole="button">
            <Ionicons name="eye-off-outline" size={20} color={colors.textDim} />
            <Txt v="small" tone="dim" style={styles.flex}>
              {t('title.blindHidden')}
            </Txt>
            <Txt v="smallStrong" tone="accent">
              {t('title.reveal')}
            </Txt>
          </Pressable>
        ) : (
          <View style={styles.community}>
            <View style={styles.avgBox}>
              <Txt v="title">{formatRating(Math.round((s.avg ?? 0) * 10) / 10)}</Txt>
              <Stars value={s.avg} size={12} />
              <Txt v="caption" tone="faint">
                {plural('ratings', s.count)}
              </Txt>
            </View>
            <View style={styles.flex}>
              <RatingHistogram histogram={s.histogram} color={color} />
              <View style={styles.histLegend}>
                <Txt v="caption" tone="faint">
                  ½
                </Txt>
                <Txt v="caption" tone="faint">
                  5★
                </Txt>
              </View>
            </View>
          </View>
        )}
      </Section>
      {s.vibes.length > 0 ? (
        <Section title={t('title.vibes')}>
          <VibeSummary vibes={s.vibes.slice(0, 6)} total={s.vibeEntries} />
        </Section>
      ) : null}
    </>
  );
}

export function FriendsSection({ media }: { media: MediaSnapshot }) {
  const { t } = useI18n();
  const friends = useFriendsOn(media);
  if (!friends.data || friends.data.length === 0) return null;
  return (
    <Section title={t('title.friends')}>
      <View style={styles.friends}>
        {friends.data.slice(0, 12).map((f) => (
          <Pressable key={f.user.id} style={styles.friend} onPress={() => openUser(f.user.id)}>
            <Avatar user={f.user} size={44} />
            <Txt v="caption" tone="dim" numberOfLines={1} style={styles.friendName}>
              {displayName(f.user)}
            </Txt>
            <View style={styles.friendMeta}>
              {f.rating != null ? <Stars value={f.rating} size={9} /> : null}
              {f.liked ? <Ionicons name="heart" size={10} color={colors.like} /> : null}
              {f.rating == null && !f.liked && f.status === 'want' ? <Ionicons name="time" size={10} color={colors.textDim} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

export function ReviewsSection({
  media,
  isSeasonUnseen,
}: {
  media: MediaSnapshot;
  isSeasonUnseen?: (season: number) => boolean;
}) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(5);
  const reviews = useMediaEntries(media, limit);
  const list = reviews.data ?? [];
  return (
    <Section title={t('title.reviews')} padded={false}>
      {list.length === 0 && !reviews.isLoading ? (
        <EmptyState
          icon="chatbubbles-outline"
          text={t('title.noReviews')}
          action={t('title.logReview')}
          onAction={() => router.push({ pathname: '/log', params: { media: mediaParam(media) } })}
        />
      ) : (
        <View style={styles.reviews}>
          {list.map((e) => (
            <EntryCard key={e.id} entry={e} showMedia={false} isSeasonUnseen={isSeasonUnseen} />
          ))}
          {list.length >= limit ? (
            <Button title={t('title.allReviews')} kind="ghost" small onPress={() => setLimit((n) => n + 20)} style={styles.moreReviews} />
          ) : null}
        </View>
      )}
    </Section>
  );
}

/** "Season 2 · 5 of 10" rows for series. */
export function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <Pressable onPress={() => setOpen((v) => !v)} disabled={!long}>
      <Txt numberOfLines={open || !long ? undefined : lines} style={styles.overview}>
        {text}
      </Txt>
      {long && !open ? (
        <Txt v="smallStrong" tone="accent" style={styles.readMore}>
          {t('title.readMore')}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  panel: {
    marginHorizontal: gutter,
    marginTop: space.xl,
    gap: space.lg,
  },
  toggles: {
    flexDirection: 'row',
  },
  rating: {
    alignItems: 'center',
    gap: space.xs,
  },
  buttons: {
    flexDirection: 'row',
  },
  secondary: {
    flexDirection: 'row',
    gap: space.sm,
  },
  blind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  community: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  avgBox: {
    alignItems: 'center',
    gap: 2,
    minWidth: 76,
  },
  histLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  friends: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  friend: {
    width: 64,
    alignItems: 'center',
    gap: 3,
  },
  friendName: {
    maxWidth: 64,
  },
  friendMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 10,
  },
  reviews: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  moreReviews: {
    alignSelf: 'center',
    marginTop: space.sm,
  },
  overview: {
    color: colors.text,
    lineHeight: 22,
  },
  readMore: {
    marginTop: 4,
  },
});
