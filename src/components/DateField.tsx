import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/i18n';
import { addDays, isValidISODate, parseISODate, toISODate, todayISO } from '@/lib/dates';
import { colors, font, radius, space } from '@/theme';

import { Chip, Txt } from './ui';

/** Date with "Today / Yesterday" shortcuts and the platform date picker. */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t, date } = useI18n();
  const [androidOpen, setAndroidOpen] = useState(false);
  const today = todayISO();
  const yesterday = addDays(today, -1);

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        <Chip label={t('common.today')} selected={value === today} onPress={() => onChange(today)} />
        <Chip label={t('common.yesterday')} selected={value === yesterday} onPress={() => onChange(yesterday)} />
      </View>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          maximumDate={new Date()}
          onValueChange={(_e, d) => onChange(toISODate(d))}
        />
      ) : Platform.OS === 'android' ? (
        <>
          <Pressable style={styles.pill} onPress={() => setAndroidOpen(true)}>
            <Txt v="smallStrong">{date(value)}</Txt>
          </Pressable>
          {androidOpen ? (
            <DateTimePicker
              value={parseISODate(value)}
              mode="date"
              maximumDate={new Date()}
              onValueChange={(_e, d) => {
                setAndroidOpen(false);
                onChange(toISODate(d));
              }}
              onDismiss={() => setAndroidOpen(false)}
            />
          ) : null}
        </>
      ) : (
        <TextInput
          key={value}
          defaultValue={value}
          onChangeText={(text) => {
            if (isValidISODate(text) && text <= today) onChange(text);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textFaint}
          style={styles.web}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
  },
  pill: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  web: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 130,
  },
});
