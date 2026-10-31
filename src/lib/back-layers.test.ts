import { consumeBackLayer, registerBackLayer } from './back-layers';

test('empty stack delegates to page history', () => {
  expect(consumeBackLayer()).toBe('pass');
});

test('only the last opened layer handles a return, including asynchronous closing', () => {
  const parent = jest.fn(() => 'handled' as const);
  const child = jest.fn(() => 'handled' as const);
  const closeParent = registerBackLayer(parent);
  const closeChild = registerBackLayer(child);
  expect(consumeBackLayer()).toBe('handled');
  expect(child).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
  closeChild();
  expect(consumeBackLayer()).toBe('handled');
  expect(parent).toHaveBeenCalledTimes(1);
  closeParent();
});

test('a busy top layer blocks return rather than exposing the parent or history', () => {
  const parent = jest.fn(() => 'handled' as const);
  const closeParent = registerBackLayer(parent);
  const closeBusy = registerBackLayer(() => 'blocked');
  expect(consumeBackLayer()).toBe('blocked');
  expect(parent).not.toHaveBeenCalled();
  closeBusy();
  closeParent();
});

test('cleanup is idempotent and cannot unregister another layer', () => {
  const first = registerBackLayer(() => 'blocked');
  const second = registerBackLayer(() => 'handled');
  first();
  first();
  expect(consumeBackLayer()).toBe('handled');
  second();
  expect(consumeBackLayer()).toBe('pass');
});
