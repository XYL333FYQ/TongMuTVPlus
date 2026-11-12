'use strict';
const { validRoom } = require('./tickets.cjs');
function resolveTogetherOperation(
  method,
  segments,
  query = new URLSearchParams()
) {
  if (
    !Array.isArray(segments) ||
    segments.some((s) => typeof s !== 'string' || !s || /[\\/%?#\0]/.test(s))
  )
    return null;
  const key = segments.join('/');
  let path, roomId;
  let queryKeys = [];
  if (key === 'clock' && method === 'GET') {
    path = '/api/public/time';
    queryKeys = ['clientSentAtNanos'];
  } else if (key === 'rooms' && method === 'POST') path = '/api/rooms';
  else if ((key === 'rooms' || key === 'directory') && method === 'GET') {
    path = key === 'rooms' ? '/api/user/rooms' : '/api/user/rooms/discover';
    queryKeys =
      key === 'rooms'
        ? [
            'page',
            'pageSize',
            'search',
            'status',
            'isBanned',
            'relation',
            'sortBy',
            'sortDirection',
          ]
        : ['page', 'pageSize', 'search', 'categoryId', 'labelIds'];
  } else if (segments[0] === 'rooms' && validRoom(segments[1])) {
    roomId = segments[1];
    const suffix = segments.slice(2).join('/');
    const operations = {
      '': { GET: '', DELETE: '' },
      membership: { PUT: '/members/@me', DELETE: '/members/@me' },
      members: { GET: '/members' },
      settings: { GET: '/settings', PATCH: '/settings' },
      visibility: { PATCH: '/visibility' },
      'settings/reset': { POST: '/settings/reset' },
      owner: { POST: '/owner' },
      password: { DELETE: '/password' },
      'password/opaque/login/start': { POST: '/password/opaque/login/start' },
      'password/opaque/login/finish': { POST: '/password/opaque/login/finish' },
      'password/opaque/registration/start': {
        PATCH: '/password/opaque/registration/start',
      },
      'password/opaque/registration/finish': {
        PATCH: '/password/opaque/registration/finish',
      },
    };
    if (
      !Object.hasOwn(operations, suffix) ||
      !Object.hasOwn(operations[suffix], method)
    )
      return null;
    path = '/api/rooms/' + roomId + operations[suffix][method];
    if (suffix === 'members' && method === 'GET')
      queryKeys = ['page', 'pageSize', 'search'];
  }
  if (!path) return null;
  const safe = new URLSearchParams();
  for (const [key, value] of query) {
    if (
      !queryKeys.includes(key) ||
      safe.has(key) ||
      value.length > 200 ||
      (key === 'clientSentAtNanos' && !/^[1-9]\d{0,18}$/.test(value)) ||
      (['page', 'pageSize'].includes(key) &&
        (!/^\d{1,6}$/.test(value) ||
          Number(value) < 1 ||
          (key === 'pageSize' && Number(value) > 100)))
    )
      throw Object.assign(new Error('Invalid together query'), { status: 400 });
    safe.append(key, value);
  }
  return { path: path + (safe.size ? '?' + safe.toString() : ''), roomId };
}
module.exports = { resolveTogetherOperation };
