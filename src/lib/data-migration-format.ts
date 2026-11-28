/**
 * 管理后台“数据迁移”的备份文件格式：导出接口写、导入接口读，两边共用这一份。
 * 导入的文件来自用户上传，可能是旧版本导出的，所以旧字段（歌单歌曲的 id / platform / pic / duration）也列着。
 */
import type { AdminConfig } from './admin.types';
import type { BookReadRecord, BookShelfItem } from './book.types';
import type { MangaReadRecord, MangaShelfItem } from './manga.types';
import type {
  MusicSource,
  MusicV2HistoryRecord,
  MusicV2PlaylistItem,
  MusicV2PlaylistRecord,
} from './music-v2';
import type { RedisCompatClient } from './redis-base.db';
import type {
  Favorite,
  IStorage,
  PlayRecord,
  SkipConfig,
  UserListV2,
} from './types';

/** 歌单里的一首歌：新版字段，加上旧版导出里的别名 */
export type BackupPlaylistSong = Partial<MusicV2PlaylistItem> & {
  id?: string;
  platform?: MusicSource;
  pic?: string;
  duration?: number;
};

export interface BackupUserData {
  playRecords?: Record<string, PlayRecord>;
  favorites?: Record<string, Favorite>;
  searchHistory?: string[];
  skipConfigs?: Record<string, SkipConfig>;
  musicV2History?: MusicV2HistoryRecord[];
  musicV2Playlists?: Array<
    MusicV2PlaylistRecord & { songs?: BackupPlaylistSong[] }
  >;
  mangaData?: {
    shelf?: Record<string, MangaShelfItem>;
    readRecords?: Record<string, MangaReadRecord>;
  };
  bookData?: {
    shelf?: Record<string, BookShelfItem>;
    readRecords?: Record<string, BookReadRecord>;
  };
  /** 新版用户存储里的密码哈希（站长是环境变量里的明文密码） */
  passwordV2?: string | null;
}

export interface BackupFile {
  timestamp: string;
  serverVersion: string;
  data: {
    adminConfig: AdminConfig;
    userData: Record<string, BackupUserData>;
    usersV2?: UserListV2['users'];
  };
}

/**
 * 迁移时按存储类型直接读写用户密码用到的那几样：
 * SQL 存储（D1 / Turso / Postgres）有 getUserPasswordHash、createUserWithHashedPassword，
 * Redis 系有 withRetry 和兼容客户端 client。
 */
export type MigrationStorage = IStorage & {
  getUserPasswordHash?(userName: string): Promise<string | null>;
  createUserWithHashedPassword?(
    userName: string,
    passwordHash: string,
    role: 'owner' | 'admin' | 'user',
    createdAt: number,
    tags?: string[],
    oidcSub?: string,
    enabledApis?: string[],
    banned?: boolean
  ): Promise<void>;
  withRetry?: <T>(operation: () => Promise<T>) => Promise<T>;
  client?: RedisCompatClient;
};
