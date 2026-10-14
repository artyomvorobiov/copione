import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useInvalidateUserData } from '@/hooks/data';
import { type TKey, type Translator, useI18n } from '@/i18n';
import { vibeById, vibePercent } from '@/lib/vibes';
import type { EntryCard as EntryCardData } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useSettings } from '@/state/settings';
import { colors, gutter, radius, space } from '@/theme';

import { Avatar, displayName, openUser, Poster, Stars } from './media';
import { Txt } from './ui';

export function vibeLabel(t: Translator['t'], id: string): string {
  const key = `vibe.${id}` as TKey;
  const text = t(key);
  return text === key ? id : text;
}

/** A review hidden behind a tap when it may spoil something. */
export function SpoilerText({
  text,
  hidden,
  reason,
  numberOfLines,
}: {
  text: string;
  hidden: boolean;
  reason?: string;
  numberOfLines?: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const { t } = useI18n();
  if (hidden && !revealed) {
    return (
      <Pressable
        onPress={() => setRevealed(true)}
        style={styles.spoiler}
        accessibilityRole="button"
        accessibilityLabel={reason ?? t('entry.spoilerHidden')}
      >
        <Ionicons name="eye-off-outline" size={16} color={colors.textDim} />
        <Txt v="small" tone="dim" style={styles.spoilerText}>
          {reason ?? t('entry.spoilerHidden')}
        </Txt>
      </Pressable>
    );
  }
  return (
    <Txt numberOfLines={numberOfLines} style={styles.review}>
      {text}
    </Txt>
  );
}

export function VibeTags({ ids, small }: { ids: string[]; small?: boolean }) {
  const { t } = useI18n();
  if (ids.length === 0) return null;
  return (
    <View style={styles.vibes}>
      {ids.map((id) => (
        <View key={id} style={[styles.vibe, small && styles.vibeSmall]}>
          <Txt v={small ? 'caption' : 'small'} tone="dim">
            {`${vibeById(id)?.emoji ?? ''} ${vibeLabel(t, id)}`.trim()}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Community vibes with the share of people who picked each one. */
export function VibeSummary({ vibes, total }: { vibes: { id: string; count: number }[]; total: number }) {
  const { t } = useI18n();
  return (
    <View style={styles.vibes}>
      {vibes.map((v) => (
        <View key={v.id} style={styles.vibe}>
          <Txt v="small">{`${vibeById(v.id)?.emoji ?? ''} ${vibeLabel(t, v.id)}`.trim()}</Txt>
          <Txt v="smallStrong" tone="dim">
            {` ${vibePercent(v.count, total)}%`}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * One diary entry / review in feeds, on title pages and in profiles.
 * `seasonSeen` hides reviews of seasons the viewer has not finished.
 */
export function EntryCard({
  entry,
  showMedia = true,
  showAuthor = true,
  maxLines = 5,
  isSeasonUnseen,
}: {
  entry: EntryCardData;
  showMedia?: boolean;
  showAuthor?: boolean;
  maxLines?: number;
  isSeasonUnseen?: (season: number) => boolean;
}) {
  const { t, timeAgo, date } = useI18n();
  const { settings } = useSettings();
  const backend = useBackend();
  const invalidate = useInvalidateUserData();
  const [liked, setLiked] = useState(entry.likedByMe);
  const [likes, setLikes] = useState(entry.likeCount);
  const isMine = entry.userId === backend.userId;
  const music = entry.media.type === 'album' || entry.media.type === 'track';

  const seasonSpoiler = !isMine && entry.season != null && !!isSeasonUnseen?.(entry.season);
  const hidden = settings.hideSpoilers && !isMine && (entry.spoilers || seasonSpoiler);
  const reason = seasonSpoiler ? t('entry.seasonSpoiler', { n: entry.season! }) : undefined;

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await backend.setEntryLike(entry.id, next);
      invalidate();
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const open = () => router.push({ pathname: '/entry/[id]', params: { id: entry.id } });
  const badges = [
    entry.rewatch ? t(music ? 'entry.relisten' : 'entry.rewatch') : null,
    entry.season != null ? t('title.seasonLabel', { n: entry.season }) : null,
  ].filter(Boolean);

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
      {showAuthor ? (
        <Pressable style={styles.author} onPress={() => openUser(entry.author.id)} hitSlop={6}>
          <Avatar user={entry.author} size={26} />
          <Txt v="smallStrong" numberOfLines={1} style={styles.authorName}>
            {displayName(entry.author)}
          </Txt>
          <Txt v="small" tone="faint">
            {timeAgo(entry.createdAt)}
          </Txt>
        </Pressable>
      ) : null}
      <View style={styles.body}>
        {showMedia ? <Poster media={entry.media} width={music ? 64 : 54} size="thumb" /> : null}
        <View style={styles.content}>
          {showMedia ? (
            <Txt v="bodyStrong" numberOfLines={2}>
              {entry.media.title}
              {entry.media.year ? <Txt tone="faint">{`  ${entry.media.year}`}</Txt> : null}
            </Txt>
          ) : null}
          {showMedia && music && entry.media.subtitle ? (
            <Txt v="small" tone="dim" numberOfLines={1}>
              {entry.media.subtitle}
            </Txt>
          ) : null}
          <View style={styles.meta}>
            <Stars value={entry.rating} size={13} />
            {entry.liked ? <Ionicons name="heart" size={13} color={colors.like} /> : null}
            {badges.map((b) => (
              <Txt key={b} v="caption" tone="faint">
                {b}
              </Txt>
            ))}
            {!showAuthor ? (
              <Txt v="small" tone="faint">
                {date(entry.watchedOn)}
              </Txt>
            ) : null}
          </View>
          {entry.review ? (
            <SpoilerText text={entry.review} hidden={hidden} reason={reason} numberOfLines={maxLines} />
          ) : null}
          <VibeTags ids={entry.vibes} small />
          <View style={styles.actions}>
            <Pressable onPress={toggleLike} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={t('title.like')}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? colors.like : colors.textFaint} />
              {likes > 0 ? (
                <Txt v="small" tone="faint">
                  {likes}
                </Txt>
              ) : null}
            </Pressable>
            <View style={styles.action}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textFaint} />
              {entry.commentCount > 0 ? (
                <Txt v="small" tone="faint">
                  {entry.commentCount}
                </Txt>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Ten half-star buckets as a compact bar chart. */
export function RatingHistogram({ histogram, height = 44, color = colors.textFaint }: { histogram: number[]; height?: number; color?: string }) {
  const max = Math.max(1, ...histogram);
  return (
    <View style={[styles.histogram, { height }]}>
      {histogram.map((n, i) => (
        <View key={i} style={styles.histCol}>
          <View style={[styles.histBar, { height: Math.max(2, (n / max) * height), backgroundColor: n ? color : colors.surface3 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  authorName: {
    flexShrink: 1,
  },
  body: {
    flexDirection: 'row',
    gap: space.md,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  review: {
    color: colors.text,
  },
  spoiler: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  spoilerText: {
    flex: 1,
  },
  vibes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  vibe: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  vibeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: space.lg,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  histogram: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  histCol: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  histBar: {
    borderRadius: 2,
  },
});
