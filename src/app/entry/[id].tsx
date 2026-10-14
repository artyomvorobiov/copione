import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SpoilerText, VibeTags } from '@/components/entry';
import { Avatar, displayName, goBack, mediaParam, openMedia, openUser, Poster, Stars } from '@/components/media';
import { EmptyState, ErrorState, IconButton, Loader, Txt } from '@/components/ui';
import { config } from '@/config';
import { useAction, useComments, useEntry, useFilmDetails, useSeenEpisodes } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { starsText } from '@/lib/rating';
import type { EntryCard } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useSettings } from '@/state/settings';
import { useToast } from '@/state/toast';
import { colors, font, gutter, radius, space } from '@/theme';

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useEntry(id ?? '');
  const { t } = useI18n();
  if (entry.isLoading) return <Loader />;
  if (entry.isError) return <ErrorState onRetry={() => entry.refetch()} />;
  if (!entry.data) return <EmptyState icon="document-outline" title={t('entry.notFound')} />;
  return <EntryView entry={entry.data} />;
}

function useSeasonUnseen(entry: EntryCard): boolean {
  const isTv = entry.media.type === 'tv' && entry.season != null;
  const seen = useSeenEpisodes(entry.media.id, isTv);
  const details = useFilmDetails('tv', entry.media.id, isTv);
  if (!isTv || !details.data) return false;
  const total = details.data.seasons.find((s) => s.season === entry.season)?.episodeCount ?? 0;
  const watched = (seen.data ?? []).filter((e) => e.season === entry.season).length;
  return total > 0 && watched < total;
}

function EntryView({ entry }: { entry: EntryCard }) {
  const { t, date, timeAgo, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const toast = useToast();
  const { settings } = useSettings();
  const comments = useComments(entry.id);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const isMine = entry.userId === backend.userId;
  const music = entry.media.type === 'album' || entry.media.type === 'track';
  const seasonUnseen = useSeasonUnseen(entry);
  const hidden = settings.hideSpoilers && !isMine && (entry.spoilers || seasonUnseen);

  const more = () => {
    if (isMine) {
      router.push({ pathname: '/log', params: { entryId: entry.id, media: mediaParam(entry.media) } });
      return;
    }
    Alert.alert(displayName(entry.author), undefined, [
      {
        text: t('common.report'),
        onPress: () =>
          act(() => backend.report({ targetType: 'entry', targetId: entry.id, reason: '' })).then((ok) => {
            if (ok) toast(t('entry.reported'));
          }),
      },
      {
        text: t('common.block'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('common.block'), t('profile.blockConfirm', { username: entry.author.username }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.block'),
              style: 'destructive',
              onPress: () =>
                act(() => backend.setBlock(entry.author.id, true)).then((ok) => {
                  if (ok) goBack();
                }),
            },
          ]),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const shareText = () => {
    Share.share({
      message: t('share.entryText', { title: entry.media.title, stars: starsText(entry.rating) || '♥', app: config.appName }),
    }).catch(() => {});
  };

  const send = async () => {
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    const ok = await act(() => backend.addComment(entry.id, body));
    setSending(false);
    if (ok) setComment('');
  };

  const deleteComment = (commentId: string) => {
    Alert.alert(t('entry.deleteComment'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => act(() => backend.deleteComment(commentId)) },
    ]);
  };

  const badges = useMemo(
    () =>
      [
        entry.rewatch ? t(music ? 'entry.relisten' : 'entry.rewatch') : null,
        entry.season != null ? t('title.seasonLabel', { n: entry.season }) : null,
      ].filter(Boolean) as string[],
    [entry, music, t],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton
                name="images-outline"
                label={t('entry.storyCard')}
                onPress={() => router.push({ pathname: '/share', params: { entry: entry.id } })}
              />
              <IconButton name="share-outline" label={t('common.share')} onPress={shareText} />
              <IconButton name={isMine ? 'create-outline' : 'ellipsis-horizontal'} label={t('common.more')} onPress={more} />
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.author} onPress={() => openUser(entry.author.id)}>
            <Avatar user={entry.author} size={40} />
            <View style={styles.flex}>
              <Txt v="bodyStrong">{displayName(entry.author)}</Txt>
              <Txt v="small" tone="faint">{`@${entry.author.username} · ${timeAgo(entry.createdAt)}`}</Txt>
            </View>
          </Pressable>

          <Pressable style={styles.media} onPress={() => openMedia(entry.media)}>
            <Poster media={entry.media} width={music ? 96 : 84} size="card" />
            <View style={styles.flex}>
              <Txt v="h2" numberOfLines={3}>
                {entry.media.title}
              </Txt>
              <Txt v="small" tone="dim">
                {[music ? entry.media.subtitle : null, entry.media.year].filter(Boolean).join(' · ')}
              </Txt>
              <View style={styles.meta}>
                <Stars value={entry.rating} size={16} />
                {entry.liked ? <Ionicons name="heart" size={16} color={colors.like} /> : null}
              </View>
              {badges.length ? (
                <Txt v="caption" tone="faint">
                  {badges.join(' · ').toUpperCase()}
                </Txt>
              ) : null}
              <Txt v="small" tone="faint">
                {t(music ? 'entry.watchedOn.music' : 'entry.watchedOn.film', { date: date(entry.watchedOn) })}
              </Txt>
            </View>
          </Pressable>

          {entry.review ? (
            <View style={styles.review}>
              <SpoilerText
                text={entry.review}
                hidden={hidden}
                reason={seasonUnseen ? t('entry.seasonSpoiler', { n: entry.season! }) : undefined}
              />
            </View>
          ) : (
            <Txt v="small" tone="faint" style={styles.noText}>
              {t('entry.noText')}
            </Txt>
          )}
          <VibeTags ids={entry.vibes} />

          <LikeBar entry={entry} />

          <Txt v="h3" style={styles.commentsTitle}>
            {t('entry.comments')}
          </Txt>
          {comments.isLoading ? (
            <Loader />
          ) : (comments.data ?? []).length === 0 ? (
            <Txt v="small" tone="faint">
              {t('entry.noComments')}
            </Txt>
          ) : (
            comments.data!.map((c) => (
              <Pressable
                key={c.id}
                style={styles.comment}
                onLongPress={() => (c.author.id === backend.userId || isMine ? deleteComment(c.id) : undefined)}
              >
                <Pressable onPress={() => openUser(c.author.id)}>
                  <Avatar user={c.author} size={30} />
                </Pressable>
                <View style={styles.flex}>
                  <Txt v="smallStrong">
                    {displayName(c.author)}
                    <Txt v="small" tone="faint">{`  ${timeAgo(c.createdAt)}`}</Txt>
                  </Txt>
                  <Txt>{c.body}</Txt>
                </View>
              </Pressable>
            ))
          )}
          <Txt v="caption" tone="faint" style={styles.likesNote}>
            {entry.commentCount > 0 ? plural('comments', entry.commentCount) : ''}
          </Txt>
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('entry.commentPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <IconButton
            name="arrow-up-circle"
            size={32}
            color={comment.trim() && !sending ? colors.accent : colors.textFaint}
            label={t('entry.send')}
            onPress={send}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function LikeBar({ entry }: { entry: EntryCard }) {
  const { t, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const [liked, setLiked] = useState(entry.likedByMe);
  const [count, setCount] = useState(entry.likeCount);
  const toggle = async () => {
    const next = !liked;
    setLiked(next);
    setCount((n) => n + (next ? 1 : -1));
    const ok = await act(() => backend.setEntryLike(entry.id, next));
    if (!ok) {
      setLiked(!next);
      setCount((n) => n + (next ? -1 : 1));
    }
  };
  return (
    <Pressable onPress={toggle} style={styles.likeBar} accessibilityRole="button" accessibilityLabel={t('title.like')}>
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.like : colors.textDim} />
      <Txt v="smallStrong" tone="dim">
        {plural('likes', count)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    padding: gutter,
    paddingBottom: 40,
    gap: space.lg,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  media: {
    flexDirection: 'row',
    gap: space.lg,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  review: {
    paddingVertical: space.xs,
  },
  noText: {
    fontStyle: 'italic',
  },
  likeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  commentsTitle: {
    marginTop: space.md,
  },
  comment: {
    flexDirection: 'row',
    gap: space.md,
  },
  likesNote: {
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    ...font.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    maxHeight: 120,
  },
});
