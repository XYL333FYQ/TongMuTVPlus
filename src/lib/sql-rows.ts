/**
 * SQL 存储（D1 / SQLite / Turso / Postgres）里几张表读出来的行，列名和 migrations/ 里的建表语句一致。
 * 只是类型：查询时用 first<行类型>() / all<行类型>() 指明，运行时不做转换。
 * 可空的列写成 `| null`；Postgres 的 BIGINT 列驱动可能给字符串，用到的地方已经按需转 Number。
 */
import type { MusicPlayRecord } from './db.client';
import type { MusicSource } from './music-v2';

export interface MusicPlayRecordRow {
  key: string;
  platform: MusicPlayRecord['platform'];
  song_id: string;
  name: string;
  artist: string;
  album: string | null;
  pic: string | null;
  play_time: number;
  duration: number;
  save_time: number;
}

export interface MusicPlaylistRow {
  id: string;
  username: string;
  name: string;
  description: string | null;
  cover: string | null;
  created_at: number;
  updated_at: number;
}

export interface MusicPlaylistSongRow {
  platform: string;
  song_id: string;
  name: string;
  artist: string;
  album: string | null;
  pic: string | null;
  duration: number;
  added_at: number;
  sort_order: number;
}

/** music_v2_history 和 music_v2_playlist_items 共有的歌曲列 */
interface MusicV2SongColumns {
  song_id: string;
  source: MusicSource;
  songmid: string | null;
  name: string;
  artist: string;
  album: string | null;
  cover: string | null;
  duration_text: string | null;
  duration_sec: number | null;
}

export interface MusicV2HistoryRow extends MusicV2SongColumns {
  play_progress_sec: number | null;
  last_played_at: number;
  play_count: number | null;
  last_quality: string | null;
  created_at: number;
  updated_at: number;
  sort_order: number | null;
}

export interface MusicV2PlaylistRow {
  id: string;
  username: string;
  name: string;
  description: string | null;
  cover: string | null;
  song_count: number | null;
  created_at: number;
  updated_at: number;
}

export interface MusicV2PlaylistItemRow extends MusicV2SongColumns {
  playlist_id: string;
  sort_order: number;
  added_at: number;
  updated_at: number;
}

export interface PlayRecordRow {
  key: string;
  title: string;
  source_name: string;
  cover: string | null;
  year: string | null;
  episode_index: number;
  total_episodes: number;
  play_time: number;
  total_time: number;
  save_time: number;
  search_title: string | null;
  new_episodes: number | null;
  /** SQLite 存 0 / 1，Postgres 是布尔 */
  is_anime: number | boolean | null;
}

export interface FavoriteRow {
  key: string;
  source_name: string;
  total_episodes: number;
  title: string;
  year: string | null;
  cover: string | null;
  save_time: number;
  search_title: string | null;
  origin: 'vod' | 'live' | null;
  is_completed: number | boolean | null;
  vod_remarks: string | null;
}

export interface MovieRequestRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  year: string | null;
  media_type: 'movie' | 'tv';
  season: number | null;
  poster: string | null;
  overview: string | null;
  /** JSON 数组字符串 */
  requested_by: string;
  request_count: number;
  status: 'pending' | 'fulfilled';
  created_at: number;
  updated_at: number;
  fulfilled_at: number | null;
  fulfilled_source: string | null;
  fulfilled_id: string | null;
}

/** 只查一列 MAX(...) 时的结果 */
export interface MaxOrderRow {
  max_order: number | null;
}
