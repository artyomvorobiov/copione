import type {
  Comment,
  DeckItem,
  Domain,
  Entry,
  EntryCard,
  EntryInput,
  EpisodeKey,
  EpisodeMark,
  FriendRating,
  LibraryFilter,
  LibraryItem,
  LibraryPatch,
  ListDetail,
  ListInput,
  ListSummary,
  MatchKind,
  MatchRoom,
  MatchRoomSummary,
  MatchState,
  MediaRef,
  MediaSnapshot,
  ProfileCard,
  ProfileLite,
  ProfilePatch,
  ReportInput,
  SeenEpisode,
  ShowInProgress,
  TastePair,
  TitleStats,
} from '@/lib/types';

export interface PageOptions {
  /** Return items created before this timestamp (feed pagination). */
  before?: string;
  /** Skip this many items (diary pagination). */
  offset?: number;
  limit?: number;
  domain?: Domain;
}

/**
 * Everything the screens need from storage. Two implementations:
 * SupabaseBackend (accounts, social features) and LocalBackend (on-device demo).
 */
export interface Backend {
  readonly kind: 'cloud' | 'local';
  /** Id of the signed-in user. */
  readonly userId: string;

  // Profiles and people
  getProfile(userId: string): Promise<ProfileCard | null>;
  updateProfile(patch: ProfilePatch): Promise<void>;
  isUsernameAvailable(username: string): Promise<boolean>;
  searchProfiles(query: string): Promise<ProfileLite[]>;
  suggestedProfiles(): Promise<ProfileLite[]>;
  listFollows(userId: string, kind: 'followers' | 'following'): Promise<ProfileLite[]>;
  setFollow(userId: string, follow: boolean): Promise<void>;
  setBlock(userId: string, block: boolean): Promise<void>;
  listBlocked(): Promise<ProfileLite[]>;
  report(input: ReportInput): Promise<void>;

  // Library: ratings, likes, watchlist
  getLibraryItems(refs: MediaRef[]): Promise<LibraryItem[]>;
  setLibrary(media: MediaSnapshot, patch: LibraryPatch): Promise<void>;
  getUserLibrary(userId: string, filter: LibraryFilter, domain?: Domain): Promise<LibraryItem[]>;
  tastePairs(otherUserId: string): Promise<TastePair[]>;

  // Diary
  addEntry(input: EntryInput): Promise<string>;
  updateEntry(id: string, input: EntryInput): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  getEntry(id: string): Promise<EntryCard | null>;
  getUserEntries(userId: string, options?: PageOptions): Promise<EntryCard[]>;
  getMediaEntries(ref: MediaRef, options?: PageOptions): Promise<EntryCard[]>;
  getFeed(options?: PageOptions): Promise<EntryCard[]>;
  /** All diary entries of a user between two dates (inclusive), for stats and export. */
  getEntriesBetween(userId: string, from: string, to: string): Promise<Entry[]>;
  setEntryLike(entryId: string, like: boolean): Promise<void>;
  getComments(entryId: string): Promise<Comment[]>;
  addComment(entryId: string, body: string): Promise<void>;
  deleteComment(commentId: string): Promise<void>;

  // Community numbers
  getTitleStats(ref: MediaRef): Promise<TitleStats>;
  getFriendsOn(ref: MediaRef): Promise<FriendRating[]>;

  // Series progress
  getSeenEpisodes(showId: string): Promise<EpisodeKey[]>;
  markEpisodes(show: MediaSnapshot, episodes: EpisodeMark[], seen: boolean): Promise<void>;
  getShowsInProgress(): Promise<ShowInProgress[]>;
  getEpisodesSeenBetween(userId: string, fromIso: string, toIso: string): Promise<SeenEpisode[]>;

  // Lists
  getUserLists(userId: string): Promise<ListSummary[]>;
  getList(id: string): Promise<ListDetail | null>;
  saveList(input: ListInput): Promise<string>;
  deleteList(id: string): Promise<void>;
  /** Ids of my lists that already contain the title. */
  listsContaining(ref: MediaRef): Promise<string[]>;
  addToList(listId: string, media: MediaSnapshot): Promise<void>;
  removeFromList(listId: string, ref: MediaRef): Promise<void>;
  reorderList(listId: string, keys: string[]): Promise<void>;

  // Match
  createRoom(kind: MatchKind, deck: DeckItem[]): Promise<MatchRoom>;
  joinRoom(code: string): Promise<MatchRoom>;
  getRoomState(roomId: string): Promise<MatchState | null>;
  swipe(roomId: string, key: string, liked: boolean): Promise<void>;
  myRooms(): Promise<MatchRoomSummary[]>;
  leaveRoom(roomId: string): Promise<void>;

  // Account
  deleteAccount(): Promise<void>;
}

/** Errors with a stable code the UI can translate. */
export class BackendError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'room_not_found'
      | 'room_full'
      | 'username_taken'
      | 'forbidden'
      | 'network'
      | 'unknown',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'BackendError';
  }
}
