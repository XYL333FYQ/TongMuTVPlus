'use strict';
function required(env, name) {
  const value = (env[name] || '').trim();
  if (!value) throw new Error(name + ' is required in SyncTV mode');
  return value;
}
function getTogetherConfig(env = process.env) {
  const mode = env.TOGETHER_BACKEND || 'legacy';
  if (!['legacy', 'synctv'].includes(mode))
    throw new Error('Invalid TOGETHER_BACKEND');
  if (mode === 'legacy') return { mode };
  const internalUrl = required(env, 'SYNCTV_INTERNAL_URL');
  let url;
  try {
    url = new URL(internalUrl);
  } catch {
    throw new Error('Invalid SYNCTV_INTERNAL_URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid SYNCTV_INTERNAL_URL');
  const adminUsername = required(env, 'SYNCTV_ADMIN_USERNAME');
  const adminPassword = required(env, 'SYNCTV_ADMIN_PASSWORD');
  const encryptionKey = env.TOGETHER_ENCRYPTION_KEY || null;
  if (encryptionKey && !/^[a-f0-9]{64}$/i.test(encryptionKey))
    throw new Error('Invalid TOGETHER_ENCRYPTION_KEY');
  return {
    mode,
    internalUrl: internalUrl.replace(/\/$/, ''),
    adminUsername,
    adminPassword,
    encryptionKey,
    dataDirectory:
      env.TOGETHER_DATA_DIRECTORY ||
      require('node:path').dirname(env.SQLITE_DB_PATH || '.data/moontv.db'),
  };
}
module.exports = { getTogetherConfig };
