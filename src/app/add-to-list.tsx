import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { mediaParam, parseMediaParam } from '@/components/media';
import { Button, EmptyState, ErrorState, Loader, Txt } from '@/components/ui';
import { useAction, useListsContaining, useUserLists } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { colors, gutter, space } from '@/theme';

/** Toggle a title in my lists (modal). */
export default function AddToListScreen() {
  const params = useLocalSearchParams<{ media?: string }>();
  const media = parseMediaParam(params.media);
  const { t, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const toast = useToast();
  const lists = useUserLists(backend.userId);
  const containing = useListsContaining(media ?? { type: 'movie', id: '' });

  if (!media) return <ErrorState />;
  if (lists.isLoading || containing.isLoading) return <Loader />;
  const inLists = new Set(containing.data ?? []);

  return (
    <FlatList
      data={lists.data ?? []}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Button
          title={t('list.new')}
          icon="add"
          kind="secondary"
          style={styles.create}
          onPress={() => router.push({ pathname: '/list-edit', params: { media: mediaParam(media) } })}
        />
      }
      ListEmptyComponent={<EmptyState icon="list-outline" text={t('list.noLists')} />}
      renderItem={({ item }) => {
        const has = inLists.has(item.id);
        return (
          <Pressable
            style={styles.row}
            onPress={async () => {
              const ok = await act(() => (has ? backend.removeFromList(item.id, media) : backend.addToList(item.id, media)));
              if (ok) toast(t(has ? 'list.removed' : 'list.added', { title: item.title }));
            }}
          >
            <View style={styles.flex}>
              <Txt v="bodyStrong">{item.title}</Txt>
              <Txt v="small" tone="faint">
                {plural('items', item.itemCount)}
              </Txt>
            </View>
            <Ionicons name={has ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={has ? colors.success : colors.textDim} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: gutter,
    paddingBottom: 60,
  },
  create: {
    marginBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
