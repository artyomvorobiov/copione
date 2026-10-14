import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Screen, TabHeader, useBottomInset } from '@/components/layout';
import { Button, Card, EmptyState, Section, Txt } from '@/components/ui';
import { errorMessage, useMyRooms } from '@/hooks/data';
import { type TKey, useI18n } from '@/i18n';
import { normalizeRoomCode } from '@/lib/random';
import { useBackend, useSession } from '@/state/session';
import { colors, font, gutter, radius, space } from '@/theme';

export default function MatchLobby() {
  const { t, timeAgo, plural } = useI18n();
  const backend = useBackend();
  const { mode } = useSession();
  const rooms = useMyRooms();
  const bottom = useBottomInset();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async () => {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 5) return;
    setJoining(true);
    try {
      const room = await backend.joinRoom(normalized);
      setCode('');
      router.push({ pathname: '/match/[id]', params: { id: room.id } });
    } catch (err) {
      Alert.alert(t('match.join'), errorMessage(err, t));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottom }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => rooms.refetch()} tintColor={colors.textDim} />}
      >
        <TabHeader title={t('match.title')} />
        <Card style={styles.hero}>
          <View style={styles.cards}>
            <View style={[styles.fakeCard, styles.fakeBack]} />
            <View style={[styles.fakeCard, styles.fakeFront]}>
              <Ionicons name="heart" size={30} color={colors.white} />
            </View>
          </View>
          <Txt tone="dim" style={styles.center}>
            {t('match.subtitle')}
          </Txt>
          {mode === 'local' ? (
            <Txt v="small" tone="faint" style={styles.center}>
              {t('match.demoBot')}
            </Txt>
          ) : null}
          <Button title={t('match.create')} icon="add" onPress={() => router.push('/match-new')} style={styles.stretch} />
        </Card>

        <Section title={t('match.join')}>
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(normalizeRoomCode(v))}
              placeholder={t('match.codePlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              style={styles.codeInput}
              onSubmitEditing={join}
            />
            <Button title={t('match.joinBtn')} onPress={join} loading={joining} disabled={code.length !== 5} />
          </View>
        </Section>

        <Section title={t('match.recent')}>
          {(rooms.data ?? []).length === 0 ? (
            <EmptyState icon="albums-outline" text={t('match.noRooms')} />
          ) : (
            rooms.data!.map((r) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.room, { opacity: pressed ? 0.75 : 1 }]}
                onPress={() => router.push({ pathname: '/match/[id]', params: { id: r.id } })}
              >
                <View style={styles.roomCode}>
                  <Txt style={font.mono}>{r.code}</Txt>
                </View>
                <View style={styles.flex}>
                  <Txt v="bodyStrong">{t(`match.kind.${r.kind}` as TKey)}</Txt>
                  <Txt v="small" tone="faint">
                    {`${plural('members', r.memberCount)} · ${timeAgo(r.createdAt)}`}
                  </Txt>
                </View>
                <View style={styles.matchCount}>
                  <Ionicons name="heart" size={14} color={r.matchCount ? colors.like : colors.textFaint} />
                  <Txt v="smallStrong" tone={r.matchCount ? 'text' : 'faint'}>
                    {r.matchCount}
                  </Txt>
                </View>
              </Pressable>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    marginHorizontal: gutter,
    marginTop: space.sm,
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.xxl,
  },
  cards: {
    width: 120,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeCard: {
    position: 'absolute',
    width: 70,
    height: 100,
    borderRadius: radius.md,
  },
  fakeBack: {
    backgroundColor: colors.music,
    transform: [{ rotate: '-12deg' }, { translateX: -18 }],
    opacity: 0.8,
  },
  fakeFront: {
    backgroundColor: colors.accent,
    transform: [{ rotate: '8deg' }, { translateX: 14 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  joinRow: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  codeInput: {
    ...font.mono,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 20,
    textAlign: 'center',
  },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  roomCode: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  matchCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
