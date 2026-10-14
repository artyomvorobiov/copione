/**
 * Core domain types shared by catalogs, backends and screens.
 *
 * Films/series come from TMDB, music from the iTunes Search API. Every title is
 * identified by its media type plus the provider's id (stored as a string).
 */

export type MediaType = 'movie' | 'tv' | 'album' | 'track';
export type Domain = 'film' | 'music';

export const FILM_TYPES: readonly MediaType[] = ['movie', 'tv'];
export const MUSIC_TYPES: readonly MediaType[] = ['album', 'track'];

export function domainOf(type: MediaType): Domain {
  return type === 'movie' || type === 'tv' ? 'film' : 'music';
}

export interface MediaRef {
  type: MediaType;
  id: string;
}

/**
 * Minimal, denormalized description of a title. It is stored together with
 * user data (ratings, diary, lists) so feeds and profiles render without
 * calling the catalog APIs again.
 */
export interface MediaSnapshot extends MediaRef {
  title: string;
  /** Artist for music, original title for films (optional). */
  subtitle?: string | null;
  /** TMDB image path ("/abc.jpg") or an absolute artwork URL. */
  poster?: string | null;
  year?: number | null;
  /** TMDB genre ids (as strings) for films, genre names for music. */
  genres?: string[];
  /** Minutes. Movie runtime, typical episode length, album or track length. */
  runtime?: number | null;
  /** Director / showrunner / artist. */
  creator?: string | null;
}

export type AlbumKind = 'album' | 'ep' | 'single' | 'compilation';

/** A title as returned by a catalog (search results, charts, cards). */
export interface MediaSummary extends MediaSnapshot {
  overview?: string | null;
  /** Catalog score 0..10 (TMDB vote average). */
  score?: number | null;
  backdrop?: string | null;
  kind?: AlbumKind | null;
  explicit?: boolean;
  previewUrl?: string | null;
  albumId?: string | null;
  artistId?: string | null;
}

export type LibraryStatus = 'want' | 'done';

export interface LibraryItem {
  userId: string;
  media: MediaSnapshot;
  status: LibraryStatus | null;
  rating: number | null;
  liked: boolean;
  updatedAt: string;
}

export interface LibraryPatch {
  status?: LibraryStatus | null;
  rating?: number | null;
  liked?: boolean;
}

export type LibraryFilter = 'done' | 'want' | 'liked' | 'rated';

export interface ProfileLite {
  id: string;
  username: string;
  displayName: string;
  avatarEmoji: string | null;
}

export interface Profile extends ProfileLite {
  bio: string;
  favFilms: MediaSnapshot[];
  favMusic: MediaSnapshot[];
  goalFilms: number | null;
  goalAlbums: number | null;
  createdAt: string;
}

export type ProfilePatch = Partial<
  Pick<Profile, 'username' | 'displayName' | 'bio' | 'avatarEmoji' | 'favFilms' | 'favMusic' | 'goalFilms' | 'goalAlbums'>
>;

export interface ProfileCard extends Profile {
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  followsMe: boolean;
  isBlocked: boolean;
  counts: {
    films: number;
    shows: number;
    albums: number;
    tracks: number;
    entriesThisYear: number;
  };
}

/** One diary record: a watch or a listen, optionally with a review. */
export interface Entry {
  id: string;
  userId: string;
  media: MediaSnapshot;
  /** For series: the season the entry is about (null = whole show). */
  season: number | null;
  /** YYYY-MM-DD */
  watchedOn: string;
  rating: number | null;
  liked: boolean;
  rewatch: boolean;
  review: string | null;
  spoilers: boolean;
  vibes: string[];
  createdAt: string;
}

export interface EntryCard extends Entry {
  author: ProfileLite;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface EntryInput {
  media: MediaSnapshot;
  season: number | null;
  watchedOn: string;
  rating: number | null;
  liked: boolean;
  rewatch: boolean;
  review: string | null;
  spoilers: boolean;
  vibes: string[];
}

export interface Comment {
  id: string;
  entryId: string;
  author: ProfileLite;
  body: string;
  createdAt: string;
}

export interface TitleStats {
  avg: number | null;
  count: number;
  /** Ratings per half-star bucket: index 0 = 0.5★ … index 9 = 5★. */
  histogram: number[];
  done: number;
  want: number;
  liked: number;
  vibes: { id: string; count: number }[];
  /** How many diary entries picked at least one vibe. */
  vibeEntries: number;
}

export interface FriendRating {
  user: ProfileLite;
  rating: number | null;
  liked: boolean;
  status: LibraryStatus | null;
}

export interface TastePair {
  media: MediaSnapshot;
  mine: number;
  theirs: number;
}

export interface EpisodeKey {
  season: number;
  episode: number;
}

export interface EpisodeMark extends EpisodeKey {
  runtime?: number | null;
}

export interface SeenEpisode extends EpisodeKey {
  showId: string;
  runtime: number | null;
  seenAt: string;
}

export interface ShowInProgress {
  media: MediaSnapshot;
  /** Library status of the show itself (done = marked as finished). */
  status: LibraryStatus | null;
  seenCount: number;
  last: EpisodeKey;
  lastSeenAt: string;
}

export interface ListSummary {
  id: string;
  userId: string;
  title: string;
  description: string;
  ranked: boolean;
  itemCount: number;
  covers: (string | null)[];
  updatedAt: string;
}

export interface ListItem {
  media: MediaSnapshot;
  position: number;
  note: string | null;
}

export interface ListDetail extends ListSummary {
  author: ProfileLite;
  items: ListItem[];
}

export interface ListInput {
  id?: string;
  title: string;
  description: string;
  ranked: boolean;
}

export type MatchKind = 'movie' | 'tv' | 'mixed' | 'music';

export interface DeckItem extends MediaSnapshot {
  overview?: string | null;
  score?: number | null;
}

export interface MatchRoom {
  id: string;
  code: string;
  hostId: string;
  kind: MatchKind;
  deck: DeckItem[];
  createdAt: string;
}

export interface MatchSwipe {
  userId: string;
  key: string;
  liked: boolean;
}

export interface MatchState {
  room: MatchRoom;
  members: ProfileLite[];
  swipes: MatchSwipe[];
}

export interface MatchRoomSummary {
  id: string;
  code: string;
  kind: MatchKind;
  hostId: string;
  createdAt: string;
  memberCount: number;
  deckSize: number;
  matchCount: number;
}

export type ReportTarget = 'entry' | 'comment' | 'profile';

export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
}
