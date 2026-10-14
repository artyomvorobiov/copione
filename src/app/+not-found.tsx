import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: '' }} />
      <EmptyState icon="compass-outline" title={t('common.empty')} action={t('tabs.feed')} onAction={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
