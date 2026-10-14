import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { goBack, parseMediaParam } from '@/components/media';
import { Field } from '@/components/SignInScreen';
import { Button, GroupTitle, Loader, SwitchRow } from '@/components/ui';
import { errorMessage, useInvalidateUserData, useList } from '@/hooks/data';
import { useI18n } from '@/i18n';
import type { ListDetail, MediaSnapshot } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { gutter, space } from '@/theme';

/** Create or edit a list. With a `media` param the new list starts with that title. */
export default function ListEditScreen() {
  const params = useLocalSearchParams<{ id?: string; media?: string }>();
  const existing = useList(params.id ?? '');
  if (params.id && existing.isLoading) return <Loader />;
  return <ListForm id={params.id} initial={existing.data ?? null} media={parseMediaParam(params.media)} />;
}

function ListForm({ id: listId, initial, media }: { id?: string; initial: ListDetail | null; media: MediaSnapshot | null }) {
  const { t } = useI18n();
  const backend = useBackend();
  const invalidate = useInvalidateUserData();
  const toast = useToast();
  const params = { id: listId };
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ranked, setRanked] = useState(initial?.ranked ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(t('list.titleLabel'), t('list.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const id = await backend.saveList({ id: params.id, title, description, ranked });
      if (media) {
        await backend.addToList(id, media);
        toast(t('list.added', { title: title.trim() }));
      }
      await invalidate();
      if (params.id || media) goBack();
      else router.replace({ pathname: '/list/[id]', params: { id } });
    } catch (err) {
      Alert.alert(t('error.title'), errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!params.id) return;
    Alert.alert(t('list.delete'), t('list.deleteConfirm', { title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await backend.deleteList(params.id!);
            await invalidate();
            router.dismissAll();
          } catch (err) {
            Alert.alert(t('error.title'), errorMessage(err, t));
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: params.id ? t('list.edit') : t('list.new'),
          headerLeft: () => <Button title={t('common.cancel')} kind="ghost" small onPress={() => goBack()} />,
          headerRight: () => <Button title={t('common.save')} small onPress={save} loading={saving} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GroupTitle>{t('list.titleLabel')}</GroupTitle>
        <Field value={title} onChangeText={setTitle} placeholder={t('list.titlePlaceholder')} autoCapitalize="sentences" maxLength={100} />
        <GroupTitle>{t('list.descLabel')}</GroupTitle>
        <Field value={description} onChangeText={setDescription} placeholder={t('list.descLabel')} autoCapitalize="sentences" multiline maxLength={1000} />
        <SwitchRow label={t('list.ranked')} value={ranked} onChange={setRanked} icon="podium-outline" />
        <Button title={t('common.save')} onPress={save} loading={saving} style={styles.save} />
        {params.id ? <Button title={t('list.delete')} kind="danger" onPress={remove} style={styles.delete} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: gutter,
    paddingBottom: 60,
  },
  save: {
    marginTop: space.xxl,
  },
  delete: {
    marginTop: space.md,
  },
});
