import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, displayName } from '@/components/media';
import { Button, EmptyState, ErrorState, Loader, Txt } from '@/components/ui';
import { useAction, useBlocked } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { useBackend } from '@/state/session';
import { colors, gutter, space } from '@/theme';

export default function BlockedScreen() {
  const { t } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const blocked = useBlocked();
  if (blocked.isLoading) return <Loader />;
  if (blocked.isError) return <ErrorState onRetry={() => blocked.refetch()} />;
  return (
    <FlatList
      data={blocked.data ?? []}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<EmptyState icon="hand-left-outline" text={t('blocked.empty')} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar user={item} size={40} />
          <View style={styles.flex}>
            <Txt v="bodyStrong">{displayName(item)}</Txt>
            <Txt v="small" tone="faint">{`@${item.username}`}</Txt>
          </View>
          <Button title={t('common.unblock')} small kind="secondary" onPress={() => act(() => backend.setBlock(item.id, false))} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
