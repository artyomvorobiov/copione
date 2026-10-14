import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageUrl } from '@/catalog';
import { Poster } from '@/components/media';
import { Txt } from '@/components/ui';
import { hashString } from '@/lib/random';
import type { MediaSnapshot } from '@/lib/types';
import { colors, gradientFor, gutter, space } from '@/theme';

/** Backdrop + poster + title block at the top of a title page. */
export function Hero({
  media,
  backdrop,
  lines,
  children,
}: {
  media: MediaSnapshot;
  backdrop?: string | null;
  /** Small lines under the title (original title, year · runtime, credits…). */
  lines: (string | null | undefined)[];
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const square = media.type === 'album' || media.type === 'track';
  const bg = imageUrl(backdrop, 'backdrop') ?? (square ? imageUrl(media.poster, 'large') : null);
  const [from, to] = gradientFor(hashString(media.title));
  const height = insets.top + (square ? 300 : 230);

  return (
    <View>
      <View style={[styles.backdrop, { height }]}>
        {bg ? (
          <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={square ? 40 : 0} transition={200} />
        ) : (
          <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(11,11,15,0.55)', 'rgba(11,11,15,0.1)', colors.bg]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        {square ? (
          <View style={[styles.squareCover, { paddingTop: insets.top + 44 }]}>
            <Poster media={media} width={210} size="large" rounded={10} />
          </View>
        ) : null}
      </View>
      <View style={[styles.info, square ? styles.infoSquare : styles.infoFilm]}>
        {!square ? <Poster media={media} width={112} size="card" style={styles.poster} /> : null}
        <View style={[styles.text, square && styles.textCenter]}>
          <Txt v="title" style={square ? styles.center : undefined}>
            {media.title}
          </Txt>
          {lines
            .filter((l): l is string => !!l)
            .map((l, i) => (
              <Txt key={i} v="small" tone={i === 0 && square ? 'text' : 'dim'} style={square ? styles.center : undefined}>
                {l}
              </Txt>
            ))}
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    width: '100%',
    backgroundColor: colors.surface,
  },
  squareCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: gutter,
    gap: space.lg,
  },
  infoFilm: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -96,
  },
  infoSquare: {
    marginTop: space.lg,
  },
  poster: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: {
    flex: 1,
    gap: 4,
    paddingBottom: 2,
  },
  textCenter: {
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
