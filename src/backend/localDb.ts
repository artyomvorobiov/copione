import type {
  Entry,
  LibraryItem,
  MatchRoom,
  MediaSnapshot,
  Profile,
  ReportInput,
  SeenEpisode,
} from '@/lib/types';

/** Everything the on-device demo backend stores (serialized to AsyncStorage). */
export interface LocalDb {
  version: number;
  meId: string;
  profiles: Profile[];
  library: LibraryItem[];
  entries: Entry[];
  likes: { userId: string; entryId: string; createdAt: string }[];
  comments: { id: string; entryId: string; userId: string; body: string; createdAt: string }[];
  follows: { followerId: string; followeeId: string; createdAt: string }[];
  blocks: { blockerId: string; blockedId: string }[];
  reports: (ReportInput & { reporterId: string; createdAt: string })[];
  episodes: (SeenEpisode & { userId: string })[];
  lists: {
    id: string;
    userId: string;
    title: string;
    description: string;
    ranked: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
  listItems: { listId: string; media: MediaSnapshot; position: number; note: string | null; addedAt: string }[];
  rooms: MatchRoom[];
  members: { roomId: string; userId: string; joinedAt: string }[];
  swipes: { roomId: string; userId: string; key: string; liked: boolean; createdAt: string }[];
}

export const LOCAL_DB_VERSION = 1;

/** Minimal async key-value storage (AsyncStorage in the app, a Map in tests). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const ME_ID = 'me';
export const BOT_ID = 'demo-bot';
