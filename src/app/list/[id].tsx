import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';

import { Avatar, displayName, MediaListItem, openUser } from '@/components/media';
import { EmptyState, ErrorState, IconButton, Loader, Txt } from '@/components/ui';
import { config } from '@/config';
import { useAction, useList } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import type { ListItem } from '@/lib/types';
import { useBackend } from '@/state/session';
import { colors, gutter, space } from '@/theme';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const list = useList(id ?? '');
  const [reorder, setReorder] = useState(false);

  if (list.isLoading) return <Loader />;
  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;
  const l = list.data;
  if (!l) return <EmptyState icon="list-outline" title={t('common.empty')} />;
  const mine = l.userId === backend.userId;

  const move = (index: number, delta: -1 | 1) => {
    const items = [...l.items];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    act(() => backend.reorderList(l.id, items.map((i) => mediaKey(i.media))));
  };

  const remove = (item: ListItem) => {
    Alert.alert(item.media.title, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => act(() => backend.removeFromList(l.id, item.media)) },
    ]);
  };

  const share = () => {
    const lines = l.items.map((i, idx) => `${l.ranked ? `${idx + 1}. ` : '— '}${i.media.title}${i.media.year ? ` (${i.media.year})` : ''}`);
    Share.share({ message: `${l.title}\n\n${lines.join('\n')}\n\n${config.appName}` }).catch(() => {});
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton name="share-outline" label={t('common.share')} onPress={share} />
              {mine ? (
                <>
                  {l.ranked && l.items.length > 1 ? (
                    <IconButton
                      name={reorder ? 'checkmark' : 'swap-vertical'}
                      label={t('list.reorder')}
                      onPress={() => setReorder((v) => !v)}
                    />
                  ) : null}
                  <IconButton
                    name="create-outline"
                    label={t('list.edit')}
                    onPress={() => router.push({ pathname: '/list-edit', params: { id: l.id } })}
                  />
                </>
              ) : null}
            </View>
          ),
        }}
      />
      <FlatList
        data={l.items}
        keyExtractor={(i) => mediaKey(i.media)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt v="title">{l.title}</Txt>
            <Pressable style={styles.author} onPress={() => openUser(l.author.id)}>
              <Avatar user={l.author} size={22} />
              <Txt v="small" tone="dim">
                {`${displayName(l.author)} · ${plural('items', l.itemCount)}`}
              </Txt>
            </Pressable>
            {l.description ? <Txt tone="dim">{l.description}</Txt> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="list-outline" text={t('list.empty')} />}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            {l.ranked ? (
              <Txt v="h3" tone="faint" style={styles.rank}>
                {index + 1}
              </Txt>
            ) : null}
            <View style={styles.flex}>
              <MediaListItem
                media={item.media}
                right={
                  mine && reorder ? (
                    <View style={styles.reorder}>
                      <IconButton name="chevron-up" label="up" onPress={() => move(index, -1)} />
                      <IconButton name="chevron-down" label="down" onPress={() => move(index, 1)} />
                    </View>
                  ) : mine ? (
                    <Pressable hitSlop={10} onPress={() => remove(item)} accessibilityLabel={t('common.remove')}>
                      <Ionicons name="close" size={18} color={colors.textFaint} />
                    </Pressable>
                  ) : undefined
                }
              />
            </View>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  content: {
    paddingHorizontal: gutter,
    paddingBottom: 60,
  },
  header: {
    gap: space.sm,
    paddingVertical: space.md,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rank: {
    width: 28,
    textAlign: 'center',
  },
  reorder: {
    flexDirection: 'row',
  },
});
