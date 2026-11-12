import { PlaybackOperations } from './operations';
test('older acknowledgements update rollback state without overwriting a newer local operation', () => {
  const tracker = new PlaybackOperations<number>();
  tracker.remember('a', 0);
  tracker.remember('b', 1);
  expect(tracker.acknowledge('a', 10)).toEqual({ handled: true });
  expect(tracker.reject('b')).toEqual({ handled: true, state: 10 });
});
test('older rejection rewires the dependent rollback; duplicate ack does not apply twice', () => {
  const tracker = new PlaybackOperations<number>();
  tracker.remember('a', 0);
  tracker.remember('b', 1);
  expect(tracker.reject('a')).toEqual({ handled: true });
  expect(tracker.acknowledge('b', 2)).toEqual({ handled: true, state: 2 });
  expect(tracker.acknowledge('b', 3)).toEqual({ handled: true });
});
test('expired and cleared operations cannot roll back a later room session', () => {
  let now = 0;
  const tracker = new PlaybackOperations<number>(() => now);
  tracker.remember('a', 1);
  now = 60001;
  expect(tracker.reject('a')).toEqual({ handled: false });
  tracker.remember('b', 2);
  tracker.clear();
  expect(tracker.reject('b')).toEqual({ handled: false });
});
