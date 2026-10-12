-- Persistent room ownership is separate from transient Socket.IO connections.
CREATE TABLE IF NOT EXISTS watch_rooms (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  room_type TEXT NOT NULL DEFAULT 'sync',
  settings_json TEXT NOT NULL DEFAULT '{}',
  state_json TEXT,
  queue_json TEXT NOT NULL DEFAULT '[]',
  revision INTEGER NOT NULL DEFAULT 1,
  controller_epoch INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  empty_since INTEGER,
  lifecycle TEXT NOT NULL DEFAULT 'active',
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_watch_rooms_owner ON watch_rooms(owner_account_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_watch_rooms_public ON watch_rooms(is_public, lifecycle, updated_at);
CREATE TABLE IF NOT EXISTS watch_room_creations (
  account_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
  PRIMARY KEY(account_id, command_id)
);
CREATE TABLE IF NOT EXISTS watch_room_memberships (
  room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  can_host INTEGER NOT NULL DEFAULT 0,
  joined_at INTEGER NOT NULL,
  last_read_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(room_id, account_id)
);
CREATE TABLE IF NOT EXISTS watch_room_messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_room_messages_room_seq ON watch_room_messages(room_id, seq);
CREATE TABLE IF NOT EXISTS watch_room_commands (
  room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(room_id, account_id, command_id)
);
