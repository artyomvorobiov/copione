import { ScrollView, StyleSheet } from 'react-native';

import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { RULES } from '@/i18n/extra';
import { gutter, space } from '@/theme';

export default function RulesScreen() {
  const { lang } = useI18n();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {RULES[lang].map((rule, i) => (
        <Txt key={i} style={styles.rule}>{`${i + 1}. ${rule}`}</Txt>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: gutter,
    gap: space.md,
    paddingBottom: 60,
  },
  rule: {
    lineHeight: 22,
  },
});
