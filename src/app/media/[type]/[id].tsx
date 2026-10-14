import { useLocalSearchParams } from 'expo-router';

import { ErrorState } from '@/components/ui';
import { FilmView } from '@/components/title/FilmView';
import { AlbumView, TrackView } from '@/components/title/MusicViews';

/** Title page for movies, series, albums and tracks: /media/movie/603 */
export default function MediaScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  if (!id) return <ErrorState />;
  if (type === 'movie' || type === 'tv') return <FilmView type={type} id={id} />;
  if (type === 'album') return <AlbumView id={id} />;
  if (type === 'track') return <TrackView id={id} />;
  return <ErrorState />;
}
