'use strict';

const crypto = require('node:crypto');

function authError(message = '请登录后连接房间') {
  return Object.assign(new Error(message), { code: 'UNAUTHORIZED', status: 401 });
}

function parseCredential(headers = {}, supplied) {
  let raw = supplied;
  if (!raw) {
    const header = headers.authorization;
    if (header) raw = header.replace(/^(Bearer|Token)\s+/i, '');
    else raw = (headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('auth='))?.slice(5);
  }
  if (typeof raw === 'object' && raw) return raw;
  if (typeof raw !== 'string' || raw.length > 16384) throw authError();
  for (let i = 0; i < 2; i++) {
    try { raw = decodeURIComponent(raw); } catch { break; }
  }
  try { return JSON.parse(raw); } catch { throw authError(); }
}

function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createRoomAuthenticator(db, options = {}) {
  // 与网页登录 Cookie 使用同一签名密钥（AUTH_SECRET，未配置时回退 PASSWORD）
  const secret = options.secret ?? (process.env.AUTH_SECRET || process.env.PASSWORD);
  const now = options.now || Date.now;
  const maxAge = 4 * 60 * 60 * 1000;
  function activeSession(identity) {
    const user = db.prepare('SELECT username, role, banned FROM users WHERE username = ?').get(identity.accountId);
    if (!user || user.banned) throw authError('账号不存在或已停用');
    const stored = db.prepare('SELECT value FROM global_config WHERE key = ?').get(`user_tokens:${identity.accountId}:${identity.tokenId}`);
    let session;
    try { session = JSON.parse(stored?.value || 'null'); } catch { throw authError(); }
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) throw authError('登录已失效，请重新登录');
    return { user, session };
  }
  return {
    authenticate(headers, supplied) {
      const auth = parseCredential(headers, supplied);
      if (!secret || typeof auth.username !== 'string' || typeof auth.role !== 'string' || !Number.isFinite(auth.timestamp) || !auth.tokenId || !auth.refreshToken || !Number.isFinite(auth.refreshExpires)) throw authError();
      if (auth.timestamp > now() + 30000 || now() - auth.timestamp > maxAge || auth.refreshExpires <= now()) throw authError('登录已过期，请刷新后重连');
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify({ username: auth.username, role: auth.role, timestamp: auth.timestamp })).digest('hex');
      if (!equalSecret(auth.signature, signature)) throw authError();
      const identity = { accountId: auth.username, name: auth.username, tokenId: auth.tokenId, authenticatedAt: now() };
      const { user, session } = activeSession(identity);
      if (user.role !== auth.role || !equalSecret(session.token, auth.refreshToken)) throw authError();
      return { ...identity, role: user.role };
    },
    validate(identity) {
      const { user } = activeSession(identity);
      if (user.role !== identity.role) throw authError('账号权限已更新，请重新连接');
      return true;
    },
  };
}

module.exports = { createRoomAuthenticator, parseCredential, authError };
