import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar, goBack, MediaListItem, openMedia, Poster } from '@/components/media';
import { MatchBadge, SwipeDeck } from '@/components/SwipeDeck';
import { Button, EmptyState, ErrorState, IconButton, Loader, Section, Txt } from '@/components/ui';
import { config } from '@/config';
import { useAction, useInvalidateUserData, useRoomState } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { findMatches } from '@/lib/deck';
import { mediaKey } from '@/lib/media';
import type { DeckItem, MatchState } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { colors, font, gutter, radius, space } from '@/theme';

export default function MatchRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const room = useRoomState(id ?? '');
  if (room.isLoading) return <Loader />;
  if (room.isError) return <ErrorState onRetry={() => room.refetch()} />;
  if (!room.data) return <EmptyState icon="albums-outline" title={t('match.notFound')} />;
  return <Room state={room.data} />;
}

function Room({ state }: { state: MatchState }) {
  const { t, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const toast = useToast();
  const invalidate = useInvalidateUserData();
  const me = backend.userId;

  // Swipes made on this device that the server may not have returned yet.
  const [local, setLocal] = useState<Map<string, boolean>>(new Map());
  const [celebrate, setCelebrate] = useState<DeckItem | null>(null);
  const [showMatches, setShowMatches] = useState(false);

  const merged: MatchState = useMemo(() => {
    const server = state.swipes.filter((s) => !(s.userId === me && local.has(s.key)));
    const mine = [...local.entries()].map(([key, liked]) => ({ userId: me, key, liked }));
    return { ...state, swipes: [...server, ...mine] };
  }, [state, local, me]);

  const swiped = useMemo(() => new Set(merged.swipes.filter((s) => s.userId === me).map((s) => s.key)), [merged, me]);
  const remaining = state.room.deck.filter((item) => !swiped.has(mediaKey(item)));
  const matches = useMemo(() => findMatches(merged), [merged]);

  // Announce matches that appear while the room is open (not the old ones).
  const announced = useRef<Set<string> | null>(null);
  useEffect(() => {
    const keys = matches.map(mediaKey);
    if (announced.current == null) {
      announced.current = new Set(keys);
      return;
    }
    const fresh = matches.find((m) => !announced.current!.has(mediaKey(m)));
    for (const k of keys) announced.current.add(k);
    if (fresh) setCelebrate(fresh);
  }, [matches]);

  const onSwipe = (item: DeckItem, liked: boolean) => {
    const key = mediaKey(item);
    setLocal((prev) => new Map(prev).set(key, liked));
    backend.swipe(state.room.id, key, liked).catch(() => {
      toast(t('common.networkError'));
    });
  };

  const invite = () => {
    Share.share({ message: t('match.inviteText', { app: config.appName, code: state.room.code }) }).catch(() => {});
  };

  const copy = async () => {
    await Clipboard.setStringAsync(state.room.code);
    toast(t('common.copied'));
  };

  const leave = () => {
    Alert.alert(t('match.leave'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('match.leave'),
        style: 'destructive',
        onPress: async () => {
          await act(() => backend.leaveRoom(state.room.id));
          goBack();
        },
      },
    ]);
  };

  const addAll = async () => {
    const ok = await act(async () => {
      for (const m of matches) await backend.setLibrary(m, { status: 'want' });
    });
    if (ok) {
      toast(t('match.addedToWatchlist'));
      invalidate();
    }
  };

  const alone = state.members.length < 2;
  const done = remaining.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('match.created', { code: state.room.code }),
          headerRight: () => <IconButton name="exit-outline" label={t('match.leave')} onPress={leave} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Pressable style={styles.code} onPress={copy} accessibilityRole="button" accessibilityLabel={t('common.copy')}>
            <Txt v="caption" tone="faint">
              {t('match.code').toUpperCase()}
            </Txt>
            <Txt style={[font.mono, styles.codeText]}>{state.room.code}</Txt>
          </Pressable>
          <View style={styles.members}>
            {state.members.slice(0, 6).map((m, i) => (
              <View key={m.id} style={[styles.member, { marginLeft: i === 0 ? 0 : -10 }]}>
                <Avatar user={m} size={34} />
              </View>
            ))}
          </View>
          <Button title={t('match.invite')} icon="person-add-outline" small kind="secondary" onPress={invite} />
        </View>
        {alone ? (
          <Txt v="small" tone="accent" style={styles.waiting}>
            {t('match.waiting')}
          </Txt>
        ) : null}

        <Pressable style={styles.matchesBar} onPress={() => setShowMatches(true)} disabled={matches.length === 0}>
          <Txt v="smallStrong" tone={matches.length ? 'like' : 'faint'}>
            {`♥ ${t('match.matches')}: ${matches.length}`}
          </Txt>
          <Txt v="small" tone="faint">
            {t('match.progress', { n: state.room.deck.length - remaining.length, total: state.room.deck.length })}
          </Txt>
        </Pressable>

        {done ? (
          <View style={styles.done}>
            <EmptyState icon="checkmark-done-outline" title={t('match.deckDone')} text={t('match.deckDoneText')} />
            <MatchList matches={matches} onAddAll={addAll} />
          </View>
        ) : (
          <SwipeDeck items={remaining} onSwipe={onSwipe} />
        )}
        <Txt v="caption" tone="faint" style={styles.hint}>
          {done ? plural('members', state.members.length) : t('match.hint')}
        </Txt>
      </ScrollView>

      <Modal visible={!!celebrate} transparent animationType="fade" onRequestClose={() => setCelebrate(null)}>
        <View style={styles.overlay}>
          {celebrate ? (
            <View style={styles.celebrate}>
              <MatchBadge />
              <Txt v="hero">{t('match.itsAMatch')}</Txt>
              <Txt tone="dim">{t('match.matchText')}</Txt>
              <Poster media={celebrate} width={celebrate.type === 'album' ? 200 : 170} size="large" />
              <Txt v="h2" style={styles.centerText}>
                {celebrate.title}
              </Txt>
              <Button
                title={t('common.open')}
                onPress={() => {
                  const item = celebrate;
                  setCelebrate(null);
                  openMedia(item);
                }}
                style={styles.stretch}
              />
              <Button title={t('match.keepSwiping')} kind="ghost" onPress={() => setCelebrate(null)} style={styles.stretch} />
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={showMatches} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMatches(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Txt v="h2">{t('match.matches')}</Txt>
            <IconButton name="close" label={t('common.close')} onPress={() => setShowMatches(false)} />
          </View>
          <ScrollView>
            <MatchList matches={matches} onAddAll={addAll} onOpen={() => setShowMatches(false)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function MatchList({ matches, onAddAll, onOpen }: { matches: DeckItem[]; onAddAll: () => void; onOpen?: () => void }) {
  const { t } = useI18n();
  if (matches.length === 0) return <EmptyState icon="heart-dislike-outline" text={t('match.noMatches')} />;
  return (
    <Section>
      {matches.map((m) => (
        <MediaListItem
          key={mediaKey(m)}
          media={m}
          onPress={() => {
            onOpen?.();
            openMedia(m);
          }}
        />
      ))}
      {matches.some((m) => m.type !== 'album') ? (
        <Button title={t('match.addAllToWatchlist')} icon="time-outline" kind="secondary" onPress={onAddAll} style={styles.addAll} />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
    paddingTop: space.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    gap: space.md,
  },
  code: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  codeText: {
    fontSize: 20,
  },
  members: {
    flexDirection: 'row',
    flex: 1,
  },
  member: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  waiting: {
    paddingHorizontal: gutter,
    marginTop: space.md,
  },
  matchesBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: gutter,
    marginVertical: space.lg,
  },
  done: {
    gap: space.md,
  },
  hint: {
    textAlign: 'center',
    marginTop: space.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
  },
  celebrate: {
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    maxWidth: 380,
  },
  centerText: {
    textAlign: 'center',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: gutter,
  },
  addAll: {
    marginTop: space.lg,
  },
});
