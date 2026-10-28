import { act, renderHook } from '@testing-library/react';

import { useLatestMediaRequest } from './useLatestMediaRequest';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

it('slow selection A cannot overwrite faster selection B or finish its loading state', async () => {
  const { result } = renderHook(() => useLatestMediaRequest('room-a:live'));
  const a = deferred<string>();
  const b = deferred<string>();
  const applied = jest.fn();
  const finishedA = jest.fn();
  const finishedB = jest.fn();
  let signalA: AbortSignal | undefined;
  const pendingA = result.current.run(
    (signal) => {
      signalA = signal;
      return a.promise;
    },
    applied,
    jest.fn(),
    finishedA
  );
  const pendingB = result.current.run(
    () => b.promise,
    applied,
    jest.fn(),
    finishedB
  );
  expect(signalA?.aborted).toBe(true);
  await act(async () => {
    b.resolve('B');
    await pendingB;
    a.resolve('A');
    await pendingA;
  });
  expect(applied).toHaveBeenCalledTimes(1);
  expect(applied).toHaveBeenCalledWith('B');
  expect(finishedA).not.toHaveBeenCalled();
  expect(finishedB).toHaveBeenCalledTimes(1);
});

it.each(['room-b:live', 'room-a:personal', 'room-a:music'])(
  'a result from an obsolete scope cannot update %s',
  async (scope) => {
    const { result, rerender } = renderHook(
      ({ value }) => useLatestMediaRequest(value),
      { initialProps: { value: 'room-a:live' } }
    );
    const request = deferred<string>();
    const applied = jest.fn();
    const error = jest.fn();
    const finished = jest.fn();
    const pending = result.current.run(
      () => request.promise,
      applied,
      error,
      finished
    );
    rerender({ value: scope });
    await act(async () => {
      request.reject(new Error('旧房请求失败'));
      await pending;
    });
    expect(applied).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
  }
);

it('unmount aborts capture of old results and suppresses all completion callbacks', async () => {
  const { result, unmount } = renderHook(() => useLatestMediaRequest('room-a'));
  const request = deferred<string>();
  let signal: AbortSignal | undefined;
  const applied = jest.fn();
  const finished = jest.fn();
  const pending = result.current.run(
    (value) => {
      signal = value;
      return request.promise;
    },
    applied,
    jest.fn(),
    finished
  );
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    request.resolve('old');
    await pending;
  });
  expect(applied).not.toHaveBeenCalled();
  expect(finished).not.toHaveBeenCalled();
});

it('a current failure reports once and completes the current loading state', async () => {
  const { result } = renderHook(() => useLatestMediaRequest('room-a'));
  const error = jest.fn();
  const finished = jest.fn();
  await act(async () => {
    await result.current.run(
      async () => {
        throw Error('源不可用');
      },
      jest.fn(),
      error,
      finished
    );
  });
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({ message: '源不可用' })
  );
  expect(finished).toHaveBeenCalledTimes(1);
});
