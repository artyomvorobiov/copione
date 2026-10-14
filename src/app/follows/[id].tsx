import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, displayName, openUser } from '@/components/media';
import { EmptyState, ErrorState, Loader, Txt } from '@/components/ui';
import { useFollows } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { colors, gutter, space } from '@/theme';

export default function FollowsScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const mode = kind === 'following' ? 'following' : 'followers';
  const { t } = useI18n();
  const follows = useFollows(id ?? '', mode);

  return (
    <>
      <Stack.Screen options={{ title: t(mode === 'followers' ? 'profile.followers' : 'profile.following') }} />
      {follows.isLoading ? (
        <Loader />
      ) : follows.isError ? (
        <ErrorState onRetry={() => follows.refetch()} />
      ) : (
        <FlatList
          data={follows.data ?? []}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={<EmptyState icon="people-outline" text={t('follows.empty')} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openUser(item.id)}>
              <Avatar user={item} size={42} />
              <View style={styles.flex}>
                <Txt v="bodyStrong">{displayName(item)}</Txt>
                <Txt v="small" tone="faint">{`@${item.username}`}</Txt>
              </View>
            </Pressable>
          )}
        />
      )}
    </>
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
