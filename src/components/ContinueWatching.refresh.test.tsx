import { act, render, screen } from '@testing-library/react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { fetchWithAuth } from '@/lib/db.client';
import { refreshPage } from '@/lib/page-refresh';

import ContinueWatching from './ContinueWatching';

const records = (title: string) => ({
  'fixture+1': {
    title,
    cover: '',
    source_name: '',
    year: '',
    play_time: 10,
    total_time: 100,
    save_time: 1,
    total_episodes: 1,
    index: 1,
  },
});
jest.mock('@/lib/auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
jest.mock('@/lib/db.client', () => ({
  fetchWithAuth: jest.fn(),
  getCachedPlayRecordsSnapshot: () => ({}),
  getAllPlayRecords: async () => records('原记录'),
  subscribeToDataUpdates: (
    name: string,
    callback: (value: unknown) => void
  ) => {
    const listener = (event: Event) => callback((event as CustomEvent).detail);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  },
}));
jest.mock('@/components/PlayRecordsPanel', () => () => null);
jest.mock('@/components/VirtualScrollableRow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));
const originalStorage = process.env.NEXT_PUBLIC_STORAGE_TYPE;
beforeEach(() => {
  document.documentElement.dataset.tmPlatform = 'app';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
  });
  (fetchWithAuth as jest.Mock).mockReset();
});
afterEach(() => {
  delete document.documentElement.dataset.tmPlatform;
  if (originalStorage === undefined)
    delete process.env.NEXT_PUBLIC_STORAGE_TYPE;
  else process.env.NEXT_PUBLIC_STORAGE_TYPE = originalStorage;
});

test('personal page refresh waits for a fresh authenticated response, not the cached getter', async () => {
  (fetchWithAuth as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => records('新记录'),
  });
  render(<ContinueWatching refreshPath='/my' />);
  await screen.findByText('原记录');
  await act(async () => expect(await refreshPage('/my')).toBe('success'));
  expect(fetchWithAuth).toHaveBeenCalledWith(
    '/api/playrecords',
    expect.objectContaining({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  );
  expect(screen.getByText('新记录')).toBeInTheDocument();
});

test('a late response after navigation cannot publish another records update', async () => {
  let finish!: (value: unknown) => void;
  (fetchWithAuth as jest.Mock).mockImplementation(
    () => new Promise((resolve) => (finish = resolve))
  );
  const { unmount } = render(<ContinueWatching refreshPath='/my' />);
  await screen.findByText('原记录');
  const update = jest.fn();
  window.addEventListener('playRecordsUpdated', update);
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = refreshPage('/my');
  });
  unmount();
  expect(await pending).toBe('cancelled');
  await act(async () =>
    finish({ ok: true, json: async () => records('迟到记录') })
  );
  expect(update).not.toHaveBeenCalled();
  window.removeEventListener('playRecordsUpdated', update);
});

test('an account switch discards the previous account response', async () => {
  (fetchWithAuth as jest.Mock).mockImplementation(async () => {
    (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
      username: 'bob',
    });
    return { ok: true, json: async () => records('Alice 私人记录') };
  });
  render(<ContinueWatching refreshPath='/my' />);
  await screen.findByText('原记录');
  await act(async () => expect(await refreshPage('/my')).toBe('failed'));
  expect(screen.queryByText('Alice 私人记录')).not.toBeInTheDocument();
  expect(screen.getByText('原记录')).toBeInTheDocument();
});
