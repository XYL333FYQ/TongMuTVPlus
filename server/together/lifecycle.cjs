'use strict';
// Shared in-process signal only. Keep this file free of Node/native imports:
// refresh-token verification is also bundled for Edge middleware.
const SLOT = Symbol.for('tongmu.together.lifecycle.v1');
function notifyTogetherRevocation(accountId, options = {}) {
  const listener = globalThis[SLOT];
  if (listener) listener(accountId, options);
}
function registerTogetherLifecycle(listener) {
  if (globalThis[SLOT] && globalThis[SLOT] !== listener)
    throw new Error('Together lifecycle already registered');
  globalThis[SLOT] = listener;
  return () => {
    if (globalThis[SLOT] === listener) delete globalThis[SLOT];
  };
}
module.exports = { notifyTogetherRevocation, registerTogetherLifecycle };
