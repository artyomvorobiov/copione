import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutter, space } from '@/theme';

import { Txt } from './ui';

/** Large title header for tab screens (they have no navigation bar). */
export function TabHeader({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  // On the web the tab bar sits at the top of the page.
  const top = insets.top + space.md + (Platform.OS === 'web' ? 56 : 0);
  return (
    <View style={[styles.header, { paddingTop: top }]}>
      <View style={styles.titleRow}>
        <Txt v="hero" numberOfLines={1} style={styles.title}>
          {title}
        </Txt>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

/** Space to keep scrollable content clear of the tab bar. */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + (Platform.OS === 'web' ? 24 : 96);
}

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
    gap: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
