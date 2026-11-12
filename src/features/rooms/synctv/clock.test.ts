import { SyncedClock, ReconnectPolicy } from './clock';
test('uses the official four timestamps without rounding epoch nanoseconds through Number', () => {
  const clock = new SyncedClock(() => 1000);
  expect(
    clock.sample(
      '1000000000000000001',
      '1000000000100000001',
      '1000000000220000001',
      '1000000000240000001'
    )
  ).toBe(true);
  expect(clock.offsetMillis).toBe(180);
  expect(clock.roundTripMillis).toBe(80);
  expect(clock.now()).toBe(1180);
});
test('impossible samples preserve the last valid offset and reset clears it', () => {
  const clock = new SyncedClock(() => 1000);
  clock.sample('1000000000', '1100000000', '1220000000', '1240000000');
  expect(clock.sample('100', '200', '300', '500')).toBe(false);
  expect(clock.offsetMillis).toBe(180);
  expect(clock.sample('invalid', '200', '300', '400')).toBe(false);
  clock.reset();
  expect(clock.now()).toBe(1000);
  expect(clock.roundTripMillis).toBeNull();
});
test('reconnect follows upstream equal jitter with a thirty-second cap and resets after success', () => {
  const policy = new ReconnectPolicy(() => 0);
  expect([policy.next(), policy.next(), policy.next()]).toEqual([
    500, 1000, 2000,
  ]);
  for (let index = 0; index < 100; index++)
    expect(policy.next()).toBeLessThanOrEqual(30000);
  expect(policy.next()).toBe(15000);
  policy.reset();
  expect(policy.next()).toBe(500);
});
