'use strict';

const { version } = require('../package.json');

function createHealthHandler(getState, options = {}) {
  const startedAt = Date.now();
  const buildSha = options.buildSha || process.env.APP_COMMIT_SHA || process.env.BUILD_SHA || 'unversioned';
  return (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== '/health' && pathname !== '/health/ready') return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
      res.end(); return true;
    }
    let ready = true;
    const state = getState();
    if (pathname === '/health/ready' && state.roomsRequired) {
      try {
        if (!state.roomDatabase?.open || !state.roomService) ready = false;
        else { state.roomDatabase.prepare('SELECT 1 FROM watch_rooms LIMIT 1').get(); }
      } catch { ready = false; }
    }
    const body = { status: ready ? 'ok' : 'unavailable', service: 'tongmutvplus', version, buildSha, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), checks: pathname === '/health/ready' ? { application: 'ok', rooms: !state.roomsRequired ? 'disabled' : ready ? 'ok' : 'unavailable' } : undefined };
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    return true;
  };
}

module.exports = { createHealthHandler };
