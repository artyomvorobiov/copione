import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { colors, font, radius, space } from '@/theme';

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search" size={18} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.input}
      />
      {value ? (
        <Pressable hitSlop={10} onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="clear">
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  input: {
    ...font.body,
    flex: 1,
    color: colors.text,
    paddingVertical: Platform.OS === 'web' ? 6 : 0,
  },
});
