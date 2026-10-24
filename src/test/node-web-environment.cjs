/* eslint-disable @typescript-eslint/no-var-requires */
// Jest 27's node environment omits Node's native Fetch globals used by NextRequest.
// Copy the real Node runtime APIs into the isolated test context, without mocking handlers.
const { createRequire } = require('node:module');
// Resolve Jest's own dependency under pnpm's isolated node_modules layout.
const jestRequire = createRequire(require.resolve('jest'));
const cliRequire = createRequire(jestRequire.resolve('jest-cli'));
const configRequire = createRequire(cliRequire.resolve('jest-config'));
const NodeEnvironment = configRequire('jest-environment-node');
const { webcrypto } = require('node:crypto');

module.exports = class NodeWebEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
    for (const name of [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'ReadableStream',
      'TransformStream',
      'TextEncoder',
      'TextDecoder',
      'AbortController',
      'AbortSignal',
    ]) {
      this.global[name] = globalThis[name];
    }
    this.global.crypto = webcrypto;
  }
};
