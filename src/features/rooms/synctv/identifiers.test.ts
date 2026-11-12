/** @jest-environment ./src/test/node-web-environment.cjs */
import { operationId } from './identifiers';
test('operation identifiers remain valid UUIDs on HTTP contexts without randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) },
    });
    expect(operationId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});
