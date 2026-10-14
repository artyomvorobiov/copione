import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { useI18n } from '@/i18n';
import { colors, font, gutter, radius, space } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* Text --------------------------------------------------------------------- */

type Variant = keyof typeof font;
type Tone = 'text' | 'dim' | 'faint' | 'accent' | 'music' | 'danger' | 'star' | 'like' | 'success';

const TONES: Record<Tone, string> = {
  text: colors.text,
  dim: colors.textDim,
  faint: colors.textFaint,
  accent: colors.accent,
  music: colors.music,
  danger: colors.danger,
  star: colors.star,
  like: colors.like,
  success: colors.success,
};

export function Txt({
  v = 'body',
  tone = 'text',
  style,
  ...rest
}: TextProps & { v?: Variant; tone?: Tone; style?: TextStyle | TextStyle[] }) {
  return <Text {...rest} style={[font[v], { color: TONES[tone] }, style]} />;
}

/* Buttons ------------------------------------------------------------------ */

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
  color,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
  /** Background color override for primary buttons (e.g. the music accent). */
  color?: string;
}) {
  const bg =
    kind === 'primary' ? color ?? colors.accent : kind === 'secondary' ? colors.surface2 : kind === 'danger' ? 'rgba(255,90,95,0.14)' : 'transparent';
  const fg = kind === 'primary' ? colors.white : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[small ? font.smallStrong : font.bodyStrong, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color = colors.text,
  size = 22,
  label,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

/** A big toggle with an icon and label (watched / like / watchlist). */
export function ToggleTile({
  icon,
  activeIcon,
  label,
  active,
  activeColor,
  onPress,
}: {
  icon: IconName;
  activeIcon: IconName;
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={active ? activeIcon : icon} size={26} color={active ? activeColor : colors.textDim} />
      <Txt v="caption" tone={active ? 'text' : 'dim'} style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

/* Chips & segments --------------------------------------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = colors.accent,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: color, borderColor: color },
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Txt v="smallStrong" tone="text" style={selected ? { color: colors.white } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, style]}>
      {children}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Txt v="smallStrong" tone={active ? 'text' : 'dim'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Layout helpers ----------------------------------------------------------- */

export function Section({
  title,
  action,
  onAction,
  children,
  style,
  padded = true,
}: {
  title?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  style?: ViewStyle;
  /** Horizontal page padding for the content (rows of cards scroll edge to edge). */
  padded?: boolean;
}) {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Txt v="h3" numberOfLines={1} style={styles.sectionTitle}>
            {title}
          </Txt>
          {action && onAction ? (
            <Pressable hitSlop={8} onPress={onAction}>
              <Txt v="smallStrong" tone="accent">
                {action}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={padded ? styles.padded : undefined}>{children}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

export function Loader({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.loader, style]}>
      <ActivityIndicator color={colors.textDim} />
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  text,
  action,
  onAction,
  style,
}: {
  icon?: IconName;
  title?: string;
  text?: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.empty, style]}>
      <Ionicons name={icon} size={30} color={colors.textFaint} />
      {title ? (
        <Txt v="h3" style={styles.centerText}>
          {title}
        </Txt>
      ) : null}
      {text ? (
        <Txt v="small" tone="dim" style={styles.centerText}>
          {text}
        </Txt>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} small kind="secondary" style={styles.emptyButton} /> : null}
    </View>
  );
}

export function ErrorState({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('common.error')}
      text={text ?? t('common.networkError')}
      action={onRetry ? t('common.retry') : undefined}
      onAction={onRetry}
    />
  );
}

/* Settings-style rows ------------------------------------------------------ */

export function Row({
  label,
  value,
  icon,
  onPress,
  danger,
  hint,
  right,
}: {
  label: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  danger?: boolean;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textDim} style={styles.rowIcon} /> : null}
      <View style={styles.rowBody}>
        <Txt tone={danger ? 'danger' : 'text'}>{label}</Txt>
        {hint ? (
          <Txt v="small" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt v="small" tone="dim" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Txt>
      ) : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  icon,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: IconName;
}) {
  return (
    <Row
      label={label}
      hint={hint}
      icon={icon}
      right={
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.surface3 }} />
      }
    />
  );
}

export function GroupTitle({ children }: { children: string }) {
  return (
    <Txt v="caption" tone="faint" style={styles.groupTitle}>
      {children.toUpperCase()}
    </Txt>
  );
}

export function ProgressBar({ value, color = colors.accent, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function PressableScale(props: PressableProps & { style?: ViewStyle | ViewStyle[] }) {
  const { style, ...rest } = props;
  return <Pressable {...rest} style={({ pressed }) => [style as ViewStyle, { opacity: pressed ? 0.8 : 1 }]} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSmall: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.sm + 2,
  },
  iconButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.sm,
  },
  tileLabel: {
    textAlign: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipIcon: {
    fontSize: 15,
  },
  chipRow: {
    gap: space.sm,
    paddingHorizontal: gutter,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm + 1,
  },
  segmentActive: {
    backgroundColor: colors.surface3,
  },
  section: {
    marginTop: space.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    marginBottom: space.md,
    gap: space.md,
  },
  sectionTitle: {
    flexShrink: 1,
  },
  padded: {
    paddingHorizontal: gutter,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  loader: {
    paddingVertical: space.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xxl,
    gap: space.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.md,
  },
  rowIcon: {
    width: 24,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowValue: {
    maxWidth: '45%',
  },
  groupTitle: {
    marginTop: space.xxl,
    marginBottom: space.sm,
    marginHorizontal: gutter + 4,
  },
  progressTrack: {
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
});
