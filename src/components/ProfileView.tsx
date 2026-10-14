import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryCard } from '@/components/entry';
import { useBottomInset } from '@/components/layout';
import { Avatar, MediaCard, Poster } from '@/components/media';
import { Button, Card, EmptyState, ErrorState, IconButton, Loader, Segmented, Txt } from '@/components/ui';
import { config } from '@/config';
import { useAction, useProfile, useTastePairs, useUserEntries, useUserLibrary, useUserLists } from '@/hooks/data';
import { useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import { splitPairsByDomain, tasteMatch } from '@/lib/tasteMatch';
import type { EntryCard as EntryCardData, LibraryItem, ListSummary, MediaSnapshot, ProfileCard } from '@/lib/types';
import { useBackend } from '@/state/session';
import { useToast } from '@/state/toast';
import { colors, gutter, radius, space } from '@/theme';

type Tab = 'diary' | 'film' | 'music' | 'want' | 'lists';

type Row =
  | { kind: 'entry'; key: string; entry: EntryCardData }
  | { kind: 'grid'; key: string; items: LibraryItem[] }
  | { kind: 'list'; key: string; list: ListSummary };

const GRID_COLUMNS = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Profile page used by the Profile tab and by /user/[id]. */
export function ProfileView({ userId, asTab }: { userId: string; asTab?: boolean }) {
  const { t } = useI18n();
  const profile = useProfile(userId);
  const [tab, setTab] = useState<Tab>('diary');
  const bottom = useBottomInset();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((Math.min(screenWidth, 600) - gutter * 2 - space.md * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  const diary = useUserEntries(userId);
  const films = useUserLibrary(userId, 'done', 'film');
  const music = useUserLibrary(userId, 'done', 'music');
  const want = useUserLibrary(userId, 'want');
  const lists = useUserLists(userId);

  const rows: Row[] = useMemo(() => {
    if (tab === 'diary') return (diary.data?.pages.flat() ?? []).map((e) => ({ kind: 'entry' as const, key: e.id, entry: e }));
    if (tab === 'lists') return (lists.data ?? []).map((l) => ({ kind: 'list' as const, key: l.id, list: l }));
    const source = tab === 'film' ? films.data : tab === 'music' ? music.data : want.data;
    return chunk(source ?? [], GRID_COLUMNS).map((items, i) => ({ kind: 'grid' as const, key: `${tab}-${i}`, items }));
  }, [tab, diary.data, lists.data, films.data, music.data, want.data]);

  const loading =
    (tab === 'diary' && diary.isLoading) ||
    (tab === 'lists' && lists.isLoading) ||
    (tab === 'film' && films.isLoading) ||
    (tab === 'music' && music.isLoading) ||
    (tab === 'want' && want.isLoading);

  if (profile.isLoading) return <Loader style={{ marginTop: insets.top + 80 }} />;
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />;
  const p = profile.data;
  if (!p) return <EmptyState icon="person-outline" title={t('profile.notFound')} />;

  const emptyText =
    tab === 'diary'
      ? p.isMe
        ? t('profile.emptyDiary')
        : t('profile.emptyDiaryOther')
      : tab === 'film'
        ? t('profile.emptyFilms')
        : tab === 'music'
          ? t('profile.emptyMusic')
          : tab === 'want'
            ? t('profile.emptyWatchlist')
            : t('profile.emptyLists');

  return (
    <FlatList
      data={p.isBlocked ? [] : rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={{ paddingBottom: asTab ? bottom : 60 }}
      ListHeaderComponent={
        <View style={{ paddingTop: asTab ? insets.top + space.md + (Platform.OS === 'web' ? 56 : 0) : space.sm }}>
          <Header profile={p} asTab={asTab} />
          {!p.isBlocked ? (
            <Segmented
              value={tab}
              onChange={setTab}
              style={styles.tabs}
              options={[
                { value: 'diary', label: t('profile.diary') },
                { value: 'film', label: t('profile.films') },
                { value: 'music', label: t('profile.music') },
                { value: 'want', label: t('profile.watchlist') },
                { value: 'lists', label: t('profile.lists') },
              ]}
            />
          ) : null}
          {tab === 'lists' && p.isMe && !p.isBlocked ? (
            <Button
              title={t('profile.newList')}
              icon="add"
              kind="secondary"
              small
              style={styles.newList}
              onPress={() => router.push('/list-edit')}
            />
          ) : null}
        </View>
      }
      ListEmptyComponent={p.isBlocked ? null : loading ? <Loader /> : <EmptyState icon="albums-outline" text={emptyText} />}
      renderItem={({ item }) => {
        if (item.kind === 'entry') return <EntryCard entry={item.entry} showAuthor={false} />;
        if (item.kind === 'list') return <ListCard list={item.list} />;
        return (
          <View style={styles.gridRow}>
            {item.items.map((lib) => (
              <MediaCard key={mediaKey(lib.media)} media={lib.media} width={cardWidth} rating={lib.rating} />
            ))}
          </View>
        );
      }}
      onEndReached={() => {
        if (tab === 'diary' && diary.hasNextPage && !diary.isFetchingNextPage) diary.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
    />
  );
}

function Header({ profile: p, asTab }: { profile: ProfileCard; asTab?: boolean }) {
  const { t, plural } = useI18n();
  const backend = useBackend();
  const act = useAction();
  const toast = useToast();

  const more = () => {
    Alert.alert(`@${p.username}`, undefined, [
      {
        text: t('common.report'),
        onPress: () =>
          act(() => backend.report({ targetType: 'profile', targetId: p.id, reason: '' })).then((ok) => {
            if (ok) toast(t('entry.reported'));
          }),
      },
      p.isBlocked
        ? { text: t('common.unblock'), onPress: () => act(() => backend.setBlock(p.id, false)) }
        : {
            text: t('common.block'),
            style: 'destructive' as const,
            onPress: () =>
              Alert.alert(t('common.block'), t('profile.blockConfirm', { username: p.username }), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.block'), style: 'destructive', onPress: () => act(() => backend.setBlock(p.id, true)) },
              ]),
          },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Avatar user={p} size={72} />
        <View style={styles.counters}>
          <Counter value={p.counts.entriesThisYear} label={t('profile.thisYear')} />
          <Counter
            value={p.followers}
            label={t('profile.followers')}
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: p.id, kind: 'followers' } })}
          />
          <Counter
            value={p.following}
            label={t('profile.following')}
            onPress={() => router.push({ pathname: '/follows/[id]', params: { id: p.id, kind: 'following' } })}
          />
        </View>
      </View>
      <View style={styles.names}>
        <Txt v="h2">{p.displayName || `@${p.username}`}</Txt>
        <Txt v="small" tone="faint">
          {`@${p.username}${p.followsMe && !p.isMe ? ` · ${t('profile.followsYou')}` : ''}`}
        </Txt>
        {p.bio ? <Txt style={styles.bio}>{p.bio}</Txt> : null}
        <Txt v="small" tone="dim">
          {[
            p.counts.films ? plural('films', p.counts.films) : null,
            p.counts.shows ? plural('series', p.counts.shows) : null,
            p.counts.albums ? plural('albums', p.counts.albums) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </View>

      {p.isBlocked ? (
        <Card style={styles.blocked}>
          <Txt tone="dim">{t('profile.blocked')}</Txt>
          <Button title={t('common.unblock')} kind="secondary" small onPress={() => act(() => backend.setBlock(p.id, false))} />
        </Card>
      ) : (
        <View style={styles.actions}>
          {p.isMe ? (
            <>
              <Button title={t('profile.edit')} kind="secondary" small style={styles.flex} onPress={() => router.push('/edit-profile')} />
              <Button
                title={t('profile.stats')}
                icon="stats-chart-outline"
                kind="secondary"
                small
                style={styles.flex}
                onPress={() => router.push('/stats')}
              />
              <IconButton
                name="share-outline"
                label={t('common.share')}
                onPress={() => Share.share({ message: t('share.profileText', { app: config.appName, username: p.username }) })}
              />
              {asTab ? <IconButton name="settings-outline" label={t('profile.settings')} onPress={() => router.push('/settings')} /> : null}
            </>
          ) : (
            <>
              <Button
                title={p.isFollowing ? t('profile.followingBtn') : t('profile.follow')}
                kind={p.isFollowing ? 'secondary' : 'primary'}
                small
                style={styles.flex}
                onPress={() => act(() => backend.setFollow(p.id, !p.isFollowing))}
              />
              <Button
                title={t('profile.stats')}
                icon="stats-chart-outline"
                kind="secondary"
                small
                style={styles.flex}
                onPress={() => router.push({ pathname: '/stats', params: { user: p.id } })}
              />
              <IconButton name="ellipsis-horizontal" label={t('common.more')} onPress={more} />
            </>
          )}
        </View>
      )}

      {!p.isMe && !p.isBlocked ? <TasteCard userId={p.id} /> : null}
      {!p.isBlocked ? (
        <>
          <Favorites title={t('profile.favFilms')} items={p.favFilms} canEdit={p.isMe} domain="film" />
          <Favorites title={t('profile.favMusic')} items={p.favMusic} canEdit={p.isMe} domain="music" />
        </>
      ) : null}
    </View>
  );
}

function Counter({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const { number } = useI18n();
  return (
    <Pressable style={styles.counter} onPress={onPress} disabled={!onPress}>
      <Txt v="h3">{number(value)}</Txt>
      <Txt v="caption" tone="faint" numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

function TasteCard({ userId }: { userId: string }) {
  const { t } = useI18n();
  const pairs = useTastePairs(userId);
  if (!pairs.data) return null;
  const split = splitPairsByDomain(pairs.data);
  const film = tasteMatch(split.film);
  const music = tasteMatch(split.music);
  const part = (label: string, score: number | null) => `${label} ${score == null ? '—' : `${score}%`}`;
  return (
    <Pressable onPress={() => router.push({ pathname: '/taste/[id]', params: { id: userId } })}>
      <Card style={styles.taste}>
        <Ionicons name="git-compare-outline" size={22} color={colors.accent} />
        <View style={styles.flex}>
          <Txt v="smallStrong">{t('profile.tasteMatch')}</Txt>
          <Txt v="small" tone="dim">
            {film.score == null && music.score == null
              ? t('profile.tasteNotEnough')
              : `${part(t('domain.film'), film.score)} · ${part(t('domain.music'), music.score)}`}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Card>
    </Pressable>
  );
}

function Favorites({
  title,
  items,
  canEdit,
  domain,
}: {
  title: string;
  items: MediaSnapshot[];
  canEdit: boolean;
  domain: 'film' | 'music';
}) {
  const { t } = useI18n();
  if (items.length === 0 && !canEdit) return null;
  const width = 76;
  return (
    <View style={styles.favorites}>
      <View style={styles.favHeader}>
        <Txt v="caption" tone="faint">
          {title.toUpperCase()}
        </Txt>
        {canEdit ? (
          <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/pick-favorites', params: { domain } })}>
            <Txt v="smallStrong" tone="accent">
              {items.length ? t('common.edit') : t('profile.addFavorites')}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {items.length > 0 ? (
        <View style={styles.favRow}>
          {items.map((m) => (
            <MediaCard key={mediaKey(m)} media={m} width={width} showMeta={false} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ListCard({ list }: { list: ListSummary }) {
  const { plural } = useI18n();
  const covers = list.covers.slice(0, 4);
  return (
    <Pressable
      style={({ pressed }) => [styles.listCard, { opacity: pressed ? 0.8 : 1 }]}
      onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
    >
      <View style={styles.covers}>
        {covers.length === 0 ? (
          <View style={styles.coverEmpty}>
            <Ionicons name="list" size={22} color={colors.textFaint} />
          </View>
        ) : (
          covers.map((c, i) => (
            <View key={i} style={[styles.coverWrap, { left: i * 22, zIndex: 10 - i }]}>
              <Poster media={{ type: c && c.startsWith('http') ? 'album' : 'movie', title: list.title, poster: c }} width={50} size="thumb" />
            </View>
          ))
        )}
      </View>
      <View style={styles.flex}>
        <Txt v="bodyStrong" numberOfLines={1}>
          {list.title}
        </Txt>
        <Txt v="small" tone="faint">
          {plural('items', list.itemCount)}
        </Txt>
        {list.description ? (
          <Txt v="small" tone="dim" numberOfLines={2}>
            {list.description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

export { ListCard };

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: gutter,
    gap: space.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  counters: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  counter: {
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
  },
  names: {
    gap: 3,
  },
  bio: {
    marginTop: space.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  blocked: {
    gap: space.md,
    alignItems: 'flex-start',
  },
  taste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  favorites: {
    gap: space.sm,
  },
  favHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tabs: {
    marginHorizontal: gutter,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  newList: {
    alignSelf: 'flex-start',
    marginHorizontal: gutter,
    marginTop: space.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingTop: space.md,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  covers: {
    width: 116,
    height: 75,
  },
  coverWrap: {
    position: 'absolute',
    top: 0,
    borderRadius: radius.sm,
    shadowColor: colors.black,
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  coverEmpty: {
    width: 50,
    height: 75,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
