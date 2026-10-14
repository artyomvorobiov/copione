import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Txt } from './ui';

/** Twelve vertical bars, one per month. */
export function MonthBars({
  values,
  labels,
  color,
  height = 90,
}: {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.col}>
            {v > 0 ? (
              <Txt v="caption" tone="faint" style={styles.value}>
                {v}
              </Txt>
            ) : null}
            <View
              style={[styles.bar, { height: Math.max(3, (v / max) * (height - 16)), backgroundColor: v ? color : colors.surface3 }]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {labels.map((l, i) => (
          <Txt key={i} v="caption" tone="faint" style={styles.label} numberOfLines={1}>
            {l}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars for "top genres / directors / artists". */
export function TopList({ items, color }: { items: { name: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <View style={styles.top}>
      {items.map((item) => (
        <View key={item.name} style={styles.topRow}>
          <View style={styles.topText}>
            <Txt v="small" numberOfLines={1} style={styles.flex}>
              {item.name}
            </Txt>
            <Txt v="smallStrong" tone="dim">
              {item.count}
            </Txt>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(item.count / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  value: {
    marginBottom: 2,
  },
  bar: {
    width: '100%',
    borderRadius: 3,
  },
  labels: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
  top: {
    gap: space.md,
  },
  topRow: {
    gap: 4,
  },
  topText: {
    flexDirection: 'row',
    gap: space.sm,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
  },
});
