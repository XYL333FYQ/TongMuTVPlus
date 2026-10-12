-- Keep the room's sequence high-water mark after expired messages are deleted.
CREATE TABLE IF NOT EXISTS watch_room_message_cursors (
  room_id TEXT PRIMARY KEY REFERENCES watch_rooms(id) ON DELETE CASCADE,
  last_seq INTEGER NOT NULL DEFAULT 0
);
INSERT INTO watch_room_message_cursors (room_id, last_seq)
SELECT room_id, MAX(seq) FROM watch_room_messages GROUP BY room_id
ON CONFLICT(room_id) DO UPDATE SET last_seq = MAX(last_seq, excluded.last_seq);
CREATE INDEX IF NOT EXISTS idx_watch_room_messages_retention ON watch_room_messages(created_at);
