import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MediaListItem, MediaRow } from '@/components/media';
import { Hero } from '@/components/title/Hero';
import { PreviewButton } from '@/components/title/MusicViews';
import { Button, ErrorState, Loader, Section } from '@/components/ui';
import { useArtist } from '@/hooks/data';
import { type TKey, useI18n } from '@/i18n';
import { mediaKey } from '@/lib/media';
import type { AlbumKind } from '@/lib/types';
import { space } from '@/theme';

const KINDS: { kind: AlbumKind; title: TKey }[] = [
  { kind: 'album', title: 'discover.albums' },
  { kind: 'ep', title: 'kind.ep' },
  { kind: 'single', title: 'kind.single' },
  { kind: 'compilation', title: 'kind.compilation' },
];

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const artist = useArtist(id ?? '');

  if (artist.isLoading) return <Loader style={styles.fill} />;
  if (artist.isError || !artist.data) return <ErrorState onRetry={() => artist.refetch()} />;
  const a = artist.data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Hero media={{ type: 'album', id: a.id, title: a.name, poster: a.image }} lines={[a.genre]} />
      {a.topTracks.length > 0 ? (
        <Section title={t('title.topSongs')}>
          {a.topTracks.slice(0, 10).map((tr) => (
            <MediaListItem key={mediaKey(tr)} media={tr} right={<PreviewButton url={tr.previewUrl} />} />
          ))}
        </Section>
      ) : null}
      {KINDS.map(({ kind, title }) => {
        const items = a.albums.filter((al) => (al.kind ?? 'album') === kind);
        if (items.length === 0) return null;
        return (
          <Section key={kind} title={t(title)} padded={false}>
            <MediaRow items={items} width={120} />
          </Section>
        );
      })}
      {a.externalUrl ? (
        <Section>
          <View style={styles.external}>
            <Button
              title={t('title.openAppleMusic')}
              icon="musical-notes-outline"
              kind="secondary"
              onPress={() => WebBrowser.openBrowserAsync(a.externalUrl!)}
            />
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    marginTop: 120,
  },
  content: {
    paddingBottom: 60,
  },
  external: {
    marginTop: space.sm,
  },
});
