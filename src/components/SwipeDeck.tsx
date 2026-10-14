import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { DeckItem } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { Poster } from './media';
import { IconButton, Txt } from './ui';

const SWIPE_THRESHOLD = 110;

function Card({ item, width }: { item: DeckItem; width: number }) {
  const { t, genre } = useI18n();
  const square = item.type === 'album' || item.type === 'track';
  const posterWidth = square ? width - 2 * space.lg : Math.min(width - 2 * space.lg, 230);
  const genres = (item.genres ?? [])
    .map((g) => genre(item.type, g))
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.posterWrap}>
        <Poster media={item} width={posterWidth} size="large" rounded={radius.md} />
      </View>
      <Txt v="h2" numberOfLines={2} style={styles.center}>
        {item.title}
      </Txt>
      <Txt v="small" tone="dim" numberOfLines={1} style={styles.center}>
        {[t(`media.${item.type}`), square ? item.subtitle : null, item.year, genres || null, item.score ? `★ ${item.score.toFixed(1)}` : null]
          .filter(Boolean)
          .join(' · ')}
      </Txt>
      {item.overview ? (
        <Txt v="small" tone="dim" numberOfLines={3} style={styles.center}>
          {item.overview}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Tinder-style card stack: drag right to like, left to skip, or use the buttons.
 */
export function SwipeDeck({
  items,
  onSwipe,
}: {
  items: DeckItem[];
  onSwipe: (item: DeckItem, liked: boolean) => void;
}) {
  const { t } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth - 32, 420);
  const [position] = useState(() => new Animated.ValueXY());
  const busy = useRef(false);
  const current = items[0];
  const next = items[1];

  const fly = useCallback(
    (liked: boolean, dy = 0) => {
      if (!current || busy.current) return;
      busy.current = true;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Animated.timing(position, {
        toValue: { x: (liked ? 1 : -1) * screenWidth * 1.4, y: dy },
        duration: 220,
        useNativeDriver: false,
      }).start(() => {
        position.setValue({ x: 0, y: 0 });
        busy.current = false;
        onSwipe(current, liked);
      });
    },
    [current, onSwipe, position, screenWidth],
  );

  const responder = useMemo(
    () =>
      // PanResponder is imperative: `fly` reads the `busy` ref only inside gesture
      // callbacks, never while rendering.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > SWIPE_THRESHOLD) fly(true, g.dy);
          else if (g.dx < -SWIPE_THRESHOLD) fly(false, g.dy);
          else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        },
      }),
    [fly, position],
  );

  if (!current) return null;

  const rotate = position.x.interpolate({ inputRange: [-screenWidth, 0, screenWidth], outputRange: ['-14deg', '0deg', '14deg'] });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const nextScale = position.x.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: [1, 0.94, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.stack, { width }]}>
        {next ? (
          <Animated.View style={[styles.layer, { transform: [{ scale: nextScale }] }]} pointerEvents="none">
            <Card item={next} width={width} />
          </Animated.View>
        ) : null}
        <Animated.View
          key={`${current.type}:${current.id}`}
          style={[styles.layer, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
          {...responder.panHandlers}
        >
          <Card item={current} width={width} />
          <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
            <Txt v="h2" style={{ color: colors.success }}>
              {t('match.likeIt').toUpperCase()}
            </Txt>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Txt v="h2" style={{ color: colors.danger }}>
              {t('match.skip').toUpperCase()}
            </Txt>
          </Animated.View>
        </Animated.View>
      </View>
      <View style={styles.buttons}>
        <View style={[styles.round, styles.roundNope]}>
          <IconButton name="close" size={34} color={colors.danger} label={t('match.skip')} onPress={() => fly(false)} />
        </View>
        <View style={[styles.round, styles.roundLike]}>
          <IconButton name="heart" size={34} color={colors.like} label={t('match.likeIt')} onPress={() => fly(true)} />
        </View>
      </View>
    </View>
  );
}

export function MatchBadge() {
  return <Ionicons name="heart" size={64} color={colors.like} />;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.xl,
  },
  stack: {
    minHeight: 520,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  posterWrap: {
    alignItems: 'center',
    marginBottom: space.sm,
  },
  center: {
    textAlign: 'center',
  },
  stamp: {
    position: 'absolute',
    top: 28,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderWidth: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11,11,15,0.6)',
  },
  stampLike: {
    left: 24,
    borderColor: colors.success,
    transform: [{ rotate: '-12deg' }],
  },
  stampNope: {
    right: 24,
    borderColor: colors.danger,
    transform: [{ rotate: '12deg' }],
  },
  buttons: {
    flexDirection: 'row',
    gap: space.xxxl,
  },
  round: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  roundNope: {
    borderColor: 'rgba(255,90,95,0.35)',
  },
  roundLike: {
    borderColor: 'rgba(255,77,109,0.35)',
  },
});
