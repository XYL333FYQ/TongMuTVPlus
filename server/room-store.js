'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function openRoomStore(filename = process.env.SQLITE_DB_PATH || path.join(process.cwd(), '.data', 'moontv.db')) {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  // Idempotent bootstrap also supports installations whose general migration runner has not run yet.
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/013_persistent_rooms.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/014_room_message_cursors.sql'), 'utf8'));
  return db;
}

class RoomStore {
  constructor(db) { this.db = db; }
  get(id) {
    const row = this.db.prepare('SELECT * FROM watch_rooms WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id, ownerAccountId: row.owner_account_id, name: row.name, description: row.description,
      passwordHash: row.password_hash, isPublic: !!row.is_public, roomType: row.room_type,
      settings: JSON.parse(row.settings_json), currentState: row.state_json ? JSON.parse(row.state_json) : null,
      queue: JSON.parse(row.queue_json), revision: row.revision, controllerEpoch: row.controller_epoch,
      createdAt: row.created_at, updatedAt: row.updated_at, emptySince: row.empty_since,
      lifecycle: row.lifecycle, archivedAt: row.archived_at,
    };
  }
  save(room) {
    this.db.prepare(`INSERT INTO watch_rooms (id,owner_account_id,name,description,password_hash,is_public,room_type,settings_json,state_json,queue_json,revision,controller_epoch,created_at,updated_at,empty_since,lifecycle,archived_at)
      VALUES (@id,@ownerAccountId,@name,@description,@passwordHash,@isPublic,@roomType,@settings,@currentState,@queue,@revision,@controllerEpoch,@createdAt,@updatedAt,@emptySince,@lifecycle,@archivedAt)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,password_hash=excluded.password_hash,is_public=excluded.is_public,room_type=excluded.room_type,settings_json=excluded.settings_json,state_json=excluded.state_json,queue_json=excluded.queue_json,revision=excluded.revision,controller_epoch=excluded.controller_epoch,updated_at=excluded.updated_at,empty_since=excluded.empty_since,lifecycle=excluded.lifecycle,archived_at=excluded.archived_at`)
      .run({ ...room, passwordHash: room.passwordHash || null, isPublic: Number(room.isPublic), settings: JSON.stringify(room.settings), currentState: room.currentState ? JSON.stringify(room.currentState) : null, queue: JSON.stringify(room.queue), archivedAt: room.archivedAt ?? null, emptySince: room.emptySince ?? null });
  }
  allIds() { return this.db.prepare('SELECT id FROM watch_rooms').all().map(row => row.id); }
  countOwned(accountId) { return this.db.prepare("SELECT COUNT(*) AS count FROM watch_rooms WHERE owner_account_id = ? AND lifecycle != 'archived'").get(accountId).count; }
  creation(accountId, commandId) { return this.db.prepare('SELECT room_id FROM watch_room_creations WHERE account_id = ? AND command_id = ?').get(accountId, commandId)?.room_id; }
  rememberCreation(accountId, commandId, roomId) { this.db.prepare('INSERT INTO watch_room_creations (account_id,command_id,room_id) VALUES (?,?,?)').run(accountId, commandId, roomId); }
  membership(id, accountId) { return this.db.prepare('SELECT * FROM watch_room_memberships WHERE room_id = ? AND account_id = ?').get(id, accountId); }
  addMember(id, accountId, canHost, now) {
    this.db.prepare('INSERT OR IGNORE INTO watch_room_memberships (room_id,account_id,can_host,joined_at) VALUES (?,?,?,?)').run(id, accountId, Number(canHost), now);
  }
  authorize(id, accountId, canHost) { this.db.prepare('UPDATE watch_room_memberships SET can_host = ? WHERE room_id = ? AND account_id = ?').run(Number(canHost), id, accountId); }
  lastSeq(id) { return this.db.prepare('SELECT last_seq FROM watch_room_message_cursors WHERE room_id = ?').get(id)?.last_seq || 0; }
  unread(id, accountId) {
    const member = this.membership(id, accountId);
    return this.db.prepare('SELECT COUNT(*) AS count FROM watch_room_messages WHERE room_id = ? AND seq > ? AND account_id != ?').get(id, member?.last_read_seq || 0, accountId).count;
  }
  markRead(id, accountId, seq) { this.db.prepare('UPDATE watch_room_memberships SET last_read_seq = MAX(last_read_seq, ?) WHERE room_id = ? AND account_id = ?').run(Math.min(seq, this.lastSeq(id)), id, accountId); }
  addMessage(message) {
    const result = this.db.prepare('INSERT INTO watch_room_messages (id,room_id,account_id,content,type,created_at) VALUES (?,?,?,?,?,?)').run(message.id, message.roomId, message.accountId, message.content, message.type, message.timestamp);
    this.db.prepare('INSERT INTO watch_room_message_cursors (room_id,last_seq) VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET last_seq=MAX(last_seq,excluded.last_seq)').run(message.roomId, Number(result.lastInsertRowid));
    return { ...message, seq: Number(result.lastInsertRowid) };
  }
  messages(id, after = 0, limit = 100) {
    return this.db.prepare('SELECT * FROM watch_room_messages WHERE room_id = ? AND seq > ? ORDER BY seq LIMIT ?').all(id, after, limit).map(row => ({ id: row.id, seq: row.seq, userId: row.account_id, accountId: row.account_id, userName: row.account_id, content: row.content, type: row.type, timestamp: row.created_at }));
  }
  latestMessages(id, limit = 100) {
    return this.db.prepare('SELECT * FROM watch_room_messages WHERE room_id = ? ORDER BY seq DESC LIMIT ?').all(id, limit).reverse().map(row => ({ id: row.id, seq: row.seq, userId: row.account_id, accountId: row.account_id, userName: row.account_id, content: row.content, type: row.type, timestamp: row.created_at }));
  }
  messagesBefore(id, before, limit = 50) {
    return this.db.prepare('SELECT * FROM watch_room_messages WHERE room_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?').all(id, before, limit).reverse().map(row => ({ id: row.id, seq: row.seq, userId: row.account_id, accountId: row.account_id, userName: row.account_id, content: row.content, type: row.type, timestamp: row.created_at }));
  }
  command(id, accountId, commandId) {
    const row = this.db.prepare('SELECT result_json FROM watch_room_commands WHERE room_id = ? AND account_id = ? AND command_id = ?').get(id, accountId, commandId);
    return row ? JSON.parse(row.result_json) : null;
  }
  remember(id, accountId, commandId, result, now) {
    this.db.prepare('INSERT INTO watch_room_commands (room_id,account_id,command_id,result_json,created_at) VALUES (?,?,?,?,?)').run(id, accountId, commandId, JSON.stringify(result), now);
  }
  purgeCommands(before) { this.db.prepare('DELETE FROM watch_room_commands WHERE created_at < ?').run(before); }
  purgeMessages(before) { this.db.prepare('DELETE FROM watch_room_messages WHERE created_at < ?').run(before); }
  remove(id) { this.db.prepare('DELETE FROM watch_rooms WHERE id = ?').run(id); }
}

module.exports = { RoomStore, openRoomStore };
