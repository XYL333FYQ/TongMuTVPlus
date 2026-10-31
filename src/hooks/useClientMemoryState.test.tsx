import { act, renderHook } from '@testing-library/react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { clearClientMemory } from '@/lib/client-memory';
import { getPlatform } from '@/lib/platform';

import { useClientMemoryState } from './useClientMemoryState';

jest.mock('@/lib/auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
jest.mock('@/lib/platform', () => ({ getPlatform: jest.fn() }));
const platform = getPlatform as jest.Mock;
const auth = getAuthInfoFromBrowserCookie as jest.Mock;

beforeEach(() => {
  clearClientMemory();
  platform.mockReturnValue('app');
  auth.mockReturnValue({ username: 'alice' });
});

test('client tab remount restores filters and functional updates', () => {
  const first = renderHook(() => useClientMemoryState('filter', 0));
  act(() => first.result.current[1]((value) => value + 2));
  first.unmount();
  const second = renderHook(() => useClientMemoryState('filter', 0));
  expect(second.result.current[0]).toBe(2);
});

test('ordinary web remount keeps its existing reset behavior', () => {
  platform.mockReturnValue('web');
  const first = renderHook(({ keyName }) => useClientMemoryState(keyName, ''), {
    initialProps: { keyName: 'draft' },
  });
  act(() => first.result.current[1]('关键词'));
  first.rerender({ keyName: 'another-query' });
  expect(first.result.current[0]).toBe('关键词');
  first.unmount();
  const second = renderHook(() => useClientMemoryState('draft', ''));
  expect(second.result.current[0]).toBe('');
});

test('key and account changes never restore or overwrite another page/user state', () => {
  const hook = renderHook(({ keyName }) => useClientMemoryState(keyName, ''), {
    initialProps: { keyName: 'movie' },
  });
  act(() => hook.result.current[1]('电影筛选'));
  const oldSetter = hook.result.current[1];
  hook.rerender({ keyName: 'tv' });
  expect(hook.result.current[0]).toBe('');
  act(() => oldSetter('旧请求迟到'));
  expect(hook.result.current[0]).toBe('');
  act(() => hook.result.current[1]('剧集筛选'));
  hook.rerender({ keyName: 'movie' });
  expect(hook.result.current[0]).toBe('电影筛选');
  auth.mockReturnValue({ username: 'bob' });
  hook.rerender({ keyName: 'movie' });
  expect(hook.result.current[0]).toBe('');
  act(() => hook.result.current[1]('另一个用户'));
  auth.mockReturnValue({ username: 'alice' });
  hook.rerender({ keyName: 'movie' });
  expect(hook.result.current[0]).toBe('电影筛选');
});
