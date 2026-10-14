import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { type ImageSize, imageUrl } from '@/catalog';
import { useI18n } from '@/i18n';
import { mediaKey, posterAspect } from '@/lib/media';
import { hashString } from '@/lib/random';
import { normalizeRating } from '@/lib/rating';
import { initials } from '@/lib/text';
import type { MediaRef, MediaSnapshot, MediaSummary, MediaType, ProfileLite } from '@/lib/types';
import { colors, font, gradientFor, gutter, radius, space } from '@/theme';

import { Txt } from './ui';

/* Navigation helpers -------------------------------------------------------- */

export function openMedia(ref: MediaRef) {
  router.push({ pathname: '/media/[type]/[id]', params: { type: ref.type, id: ref.id } });
}

export function openUser(userId: string) {
  router.push({ pathname: '/user/[id]', params: { id: userId } });
}

/** Back, or to the feed when the screen was opened directly (deep link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Snapshots travel between screens as a JSON route param. */
export function mediaParam(m: MediaSnapshot): string {
  return JSON.stringify({
    type: m.type,
    id: m.id,
    title: m.title,
    subtitle: m.subtitle ?? null,
    poster: m.poster ?? null,
    year: m.year ?? null,
    genres: m.genres ?? [],
    runtime: m.runtime ?? null,
    creator: m.creator ?? null,
  });
}

export function parseMediaParam(value: string | string[] | undefined): MediaSnapshot | null {
  if (typeof value !== 'string') return null;
  try {
    const m = JSON.parse(value) as MediaSnapshot;
    return m && m.type && m.id && m.title ? m : null;
  } catch {
    return null;
  }
}

const TYPE_ICON: Record<MediaType, keyof typeof Ionicons.glyphMap> = {
  movie: 'film-outline',
  tv: 'tv-outline',
  album: 'disc-outline',
  track: 'musical-note-outline',
};

/* Poster -------------------------------------------------------------------- */

export function Poster({
  media,
  width,
  size = 'card',
  rounded = radius.sm,
  style,
}: {
  media: Pick<MediaSnapshot, 'type' | 'title' | 'poster'>;
  width: number;
  size?: ImageSize;
  rounded?: number;
  style?: ViewStyle;
}) {
  const height = width / posterAspect(media.type);
  const uri = imageUrl(media.poster, size);
  const box: ViewStyle = { width, height, borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.surface2 };
  if (uri) {
    return (
      <View style={[box, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} />
      </View>
    );
  }
  const [from, to] = gradientFor(hashString(media.title));
  if (width < 64) {
    // Thumbnails are too small for a title: show its initials instead.
    return (
      <View style={[box, style]}>
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.placeholderTitle, { fontSize: width * 0.34 }]}>{initials(media.title)}</Text>
        </LinearGradient>
      </View>
    );
  }
  const small = width < 90;
  // Size the title so its longest word fits on one line (no mid-word breaks).
  const longestWord = media.title.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  const inner = width - (small ? 10 : 16);
  const fontSize = Math.max(9, Math.min(18, width / 7, inner / (longestWord * 0.62)));
  return (
    <View style={[box, style]}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.placeholderInner, small && styles.placeholderSmall]}>
        <Ionicons name={TYPE_ICON[media.type]} size={small ? 14 : 18} color="rgba(255,255,255,0.75)" />
        <Text numberOfLines={small ? 3 : 4} style={[styles.placeholderTitle, { fontSize }]}>
          {media.title}
        </Text>
      </View>
    </View>
  );
}

/* Stars --------------------------------------------------------------------- */

/** Read-only rating: only the earned stars, like ★★★½. */
export function Stars({ value, size = 12, color = colors.star }: { value: number | null | undefined; size?: number; color?: string }) {
  const r = normalizeRating(value);
  if (r == null) return null;
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return (
    <View style={styles.stars} accessibilityLabel={`${r} / 5`}>
      {Array.from({ length: full }, (_, i) => (
        <Ionicons key={i} name="star" size={size} color={color} />
      ))}
      {half ? <Ionicons name="star-half" size={size} color={color} /> : null}
    </View>
  );
}

/**
 * Interactive half-star rating. Tap or drag across the stars; tapping the
 * current value again clears the rating.
 */
export function StarInput({
  value,
  onChange,
  size = 36,
  color = colors.star,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: number;
  color?: string;
}) {
  const [draft, setDraftState] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const width = useRef(0);
  const moved = useRef(false);
  const shown = draft ?? value ?? 0;

  const setDraft = (next: number | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const at = (x: number) => {
    const star = width.current / 5;
    if (star <= 0) return null;
    return normalizeRating(Math.max(0.5, Math.min(5, Math.ceil((x / star) * 2) / 2)));
  };
  const tick = (next: number | null) => {
    if (next !== draftRef.current && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setDraft(next);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={value ? `${value} / 5` : undefined}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const current = value ?? 0;
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(5, current + 0.5));
        if (e.nativeEvent.actionName === 'decrement') onChange(current - 0.5 >= 0.5 ? current - 0.5 : null);
      }}
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        moved.current = false;
        tick(at(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        moved.current = true;
        tick(at(e.nativeEvent.locationX));
      }}
      onResponderRelease={() => {
        const next = draftRef.current;
        setDraft(null);
        if (next == null) return;
        onChange(!moved.current && next === value ? null : next);
      }}
      onResponderTerminate={() => setDraft(null)}
      style={styles.starInput}
    >
      <View pointerEvents="none" style={styles.starInputRow}>
        {[1, 2, 3, 4, 5].map((i) => {
          const name = shown >= i ? 'star' : shown >= i - 0.5 ? 'star-half' : 'star-outline';
          return <Ionicons key={i} name={name} size={size} color={shown >= i - 0.5 ? color : colors.surface3} />;
        })}
      </View>
    </View>
  );
}

/* Avatar -------------------------------------------------------------------- */

export function Avatar({ user, size = 36 }: { user: Pick<ProfileLite, 'username' | 'displayName' | 'avatarEmoji'>; size?: number }) {
  const [from, to] = gradientFor(hashString(user.username));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient colors={[from, to]} style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={{ fontSize: user.avatarEmoji ? size * 0.5 : size * 0.38, color: colors.white, fontWeight: '700' }}>
          {user.avatarEmoji || initials(user.displayName || user.username)}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function displayName(user: Pick<ProfileLite, 'username' | 'displayName'>): string {
  return user.displayName || `@${user.username}`;
}

/* Cards and rows ------------------------------------------------------------ */

export function MediaCard({
  media,
  width = 110,
  rating,
  onPress,
  showMeta = true,
}: {
  media: MediaSummary | MediaSnapshot;
  width?: number;
  rating?: number | null;
  onPress?: () => void;
  showMeta?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => openMedia(media))}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.8 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={media.title}
    >
      <Poster media={media} width={width} />
      {showMeta ? (
        <View style={styles.cardMeta}>
          <Txt v="smallStrong" numberOfLines={1}>
            {media.title}
          </Txt>
          {rating != null ? (
            <Stars value={rating} size={11} />
          ) : (
            <Txt v="small" tone="faint" numberOfLines={1}>
              {[media.subtitle && (media.type === 'album' || media.type === 'track') ? media.subtitle : null, media.year]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

export function MediaRow({ items, width = 112 }: { items: (MediaSummary | MediaSnapshot)[]; width?: number }) {
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(m) => mediaKey(m)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item }) => <MediaCard media={item} width={width} />}
    />
  );
}

export function MediaListItem({
  media,
  onPress,
  right,
  caption,
}: {
  media: MediaSummary | MediaSnapshot;
  onPress?: () => void;
  right?: React.ReactNode;
  caption?: string;
}) {
  const { t } = useI18n();
  const kind = 'kind' in media && media.kind ? t(`kind.${media.kind}`) : t(`media.${media.type}`);
  const meta = [kind, media.subtitle && (media.type === 'album' || media.type === 'track') ? media.subtitle : null, media.year]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress ?? (() => openMedia(media))}
      style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
    >
      <Poster media={media} width={media.type === 'album' || media.type === 'track' ? 56 : 46} size="thumb" />
      <View style={styles.listBody}>
        <Txt v="bodyStrong" numberOfLines={2}>
          {media.title}
        </Txt>
        <Txt v="small" tone="dim" numberOfLines={1}>
          {meta}
        </Txt>
        {caption ? (
          <Txt v="small" tone="faint" numberOfLines={1}>
            {caption}
          </Txt>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInner: {
    flex: 1,
    padding: space.sm,
    justifyContent: 'space-between',
  },
  placeholderSmall: {
    padding: 5,
  },
  placeholderTitle: {
    ...font.smallStrong,
    color: colors.white,
    fontWeight: '800',
    lineHeight: undefined,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  starInput: {
    alignSelf: 'center',
    paddingVertical: space.xs,
  },
  starInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardMeta: {
    marginTop: 6,
    gap: 2,
  },
  row: {
    paddingHorizontal: gutter,
    gap: space.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  listBody: {
    flex: 1,
    gap: 2,
  },
});
