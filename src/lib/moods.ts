/**
 * "Pick by mood": each mood maps to TMDB genres (OR-ed) for movies and series.
 * TMDB genre ids: https://developer.themoviedb.org/reference/genre-movie-list
 */
export interface Mood {
  id: string;
  emoji: string;
  movie: number[];
  tv: number[];
  /** Genres to exclude, e.g. no horror in a cozy evening. */
  without?: number[];
}

export const MOODS: readonly Mood[] = [
  { id: 'laugh', emoji: '😂', movie: [35], tv: [35], without: [27, 53] },
  { id: 'cry', emoji: '😭', movie: [18, 10749], tv: [18], without: [27, 35] },
  { id: 'thrill', emoji: '😱', movie: [53, 27], tv: [9648, 80] },
  { id: 'mind', emoji: '🤯', movie: [878, 9648], tv: [10765, 9648] },
  { id: 'cozy', emoji: '🫶', movie: [16, 10751], tv: [16, 10751], without: [27, 53, 80] },
  { id: 'adrenaline', emoji: '⚡', movie: [28, 12], tv: [10759] },
  { id: 'love', emoji: '💘', movie: [10749], tv: [18], without: [27] },
  { id: 'crime', emoji: '🕵️', movie: [80], tv: [80] },
  { id: 'real', emoji: '🌍', movie: [99, 36], tv: [99] },
];

export function moodById(id: string): Mood | undefined {
  return MOODS.find((m) => m.id === id);
}
