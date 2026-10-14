import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, goBack } from '@/components/media';
import { Field } from '@/components/SignInScreen';
import { Button, GroupTitle, Loader, Txt } from '@/components/ui';
import { errorMessage, useInvalidateUserData, useProfile } from '@/hooks/data';
import { useI18n } from '@/i18n';
import type { ProfileCard } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { colors, gutter, radius, space } from '@/theme';

const EMOJIS = ['🎬', '🍿', '🎞️', '🎥', '📼', '🎧', '🎸', '🎹', '🎤', '💿', '🚀', '👽', '🤖', '🦖', '🧛', '👻', '🕵️', '🐉', '🦊', '🐼', '🐸', '🌚', '🔥', '🌈'];

export default function EditProfileScreen() {
  const backend = useBackend();
  const profile = useProfile(backend.userId);
  if (!profile.data) return <Loader />;
  return <EditProfileForm profile={profile.data} />;
}

function EditProfileForm({ profile: p }: { profile: ProfileCard }) {
  const { t } = useI18n();
  const backend = useBackend();
  const invalidate = useInvalidateUserData();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(p.displayName);
  const [username, setUsername] = useState(p.username);
  const [bio, setBio] = useState(p.bio);
  const [emoji, setEmoji] = useState<string | null>(p.avatarEmoji);
  const [goalFilms, setGoalFilms] = useState(p.goalFilms ? String(p.goalFilms) : '');
  const [goalAlbums, setGoalAlbums] = useState(p.goalAlbums ? String(p.goalAlbums) : '');
  const [saving, setSaving] = useState(false);

  const goal = (v: string) => {
    const n = Number(v.replace(/\D/g, ''));
    return n > 0 ? Math.min(n, 5000) : null;
  };

  const save = async () => {
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      Alert.alert(t('editProfile.username'), t('editProfile.usernameHint'));
      return;
    }
    setSaving(true);
    try {
      if (name !== p.username && !(await backend.isUsernameAvailable(name))) {
        Alert.alert(t('editProfile.username'), t('editProfile.usernameTaken'));
        return;
      }
      await backend.updateProfile({
        displayName: displayName.trim(),
        username: name,
        bio: bio.trim(),
        avatarEmoji: emoji,
        goalFilms: goal(goalFilms),
        goalAlbums: goal(goalAlbums),
      });
      await invalidate();
      toast(t('editProfile.saved'));
      goBack();
    } catch (err) {
      Alert.alert(t('error.title'), errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <Button title={t('common.cancel')} kind="ghost" small onPress={() => goBack()} />,
          headerRight: () => <Button title={t('common.save')} small onPress={save} loading={saving} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Avatar user={{ username, displayName, avatarEmoji: emoji }} size={84} />
        </View>
        <GroupTitle>{t('editProfile.avatar')}</GroupTitle>
        <View style={styles.emojis}>
          <Pressable style={[styles.emoji, !emoji && styles.emojiActive]} onPress={() => setEmoji(null)}>
            <Txt v="smallStrong">Aa</Txt>
          </Pressable>
          {EMOJIS.map((e) => (
            <Pressable key={e} style={[styles.emoji, emoji === e && styles.emojiActive]} onPress={() => setEmoji(e)}>
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <GroupTitle>{t('editProfile.name')}</GroupTitle>
        <Field value={displayName} onChangeText={setDisplayName} placeholder={t('editProfile.name')} autoCapitalize="words" maxLength={40} />
        <GroupTitle>{t('editProfile.username')}</GroupTitle>
        <Field
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="username"
          maxLength={20}
        />
        <Txt v="caption" tone="faint" style={styles.hint}>
          {t('editProfile.usernameHint')}
        </Txt>
        <GroupTitle>{t('editProfile.bio')}</GroupTitle>
        <Field value={bio} onChangeText={setBio} placeholder={t('editProfile.bio')} autoCapitalize="sentences" multiline maxLength={300} />
        <GroupTitle>{t('editProfile.goalFilms')}</GroupTitle>
        <Field value={goalFilms} onChangeText={setGoalFilms} placeholder="50" keyboard="number-pad" maxLength={4} />
        <GroupTitle>{t('editProfile.goalAlbums')}</GroupTitle>
        <Field value={goalAlbums} onChangeText={setGoalAlbums} placeholder="52" keyboard="number-pad" maxLength={4} />
        <Txt v="caption" tone="faint" style={styles.hint}>
          {t('editProfile.goalHint')}
        </Txt>
        <View style={styles.favorites}>
          <Button
            title={`${t('editProfile.favFilms')} (${p.favFilms.length}/4)`}
            kind="secondary"
            icon="film-outline"
            onPress={() => router.push({ pathname: '/pick-favorites', params: { domain: 'film' } })}
          />
          <Button
            title={`${t('editProfile.favMusic')} (${p.favMusic.length}/4)`}
            kind="secondary"
            icon="disc-outline"
            onPress={() => router.push({ pathname: '/pick-favorites', params: { domain: 'music' } })}
          />
        </View>
        <Button title={t('common.save')} onPress={save} loading={saving} style={styles.save} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: gutter,
    paddingBottom: 60,
  },
  avatar: {
    alignItems: 'center',
    marginTop: space.md,
  },
  emojis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  emojiText: {
    fontSize: 22,
  },
  hint: {
    marginTop: space.xs,
  },
  favorites: {
    gap: space.md,
    marginTop: space.xxl,
  },
  save: {
    marginTop: space.xxl,
  },
});
