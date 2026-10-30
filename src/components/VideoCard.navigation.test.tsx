jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'viewer', role: 'user' }),
}));
jest.mock('@/lib/db.client', () => ({
  isFavorited: async () => false,
  subscribeToDataUpdates: () => () => undefined,
  generateStorageKey: (source: string, id: string) => `${source}:${id}`,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => null,
}));
jest.mock('@/components/DetailPanel', () => ({
  __esModule: true,
  default: ({ onTogether }: { onTogether: () => void }) => (
    <button onClick={onTogether}>一起看</button>
  ),
}));
jest.mock('@/components/AnimeSubscribeModal', () => () => null);
jest.mock('@/components/AIChatPanel.lazy', () => ({
  __esModule: true,
  default: () => null,
  preloadAIChatPanel: () => undefined,
}));
jest.mock('@/components/TrailerPickerDialog', () => () => null);
jest.mock('@/components/feedback/ImageViewer', () => () => null);
jest.mock('@/components/feedback/MobileActionSheet', () => () => null);
jest.mock('@/components/ImagePlaceholder', () => ({
  ImagePlaceholder: () => null,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import VideoCard from './VideoCard';

const mockPush = jest.fn();
beforeEach(() => {
  mockPush.mockReset();
  window.history.replaceState({}, '', '/');
});

test('selecting from the playback page uses client navigation without reloading', () => {
  window.history.replaceState({}, '', '/play?source=fixture&id=old');
  render(
    <VideoCard
      from='search'
      source='fixture'
      id='next'
      title='下一部'
      year='2026'
    />
  );
  fireEvent.keyDown(screen.getByRole('button', { name: '查看 下一部' }), {
    key: 'Enter',
  });
  expect(mockPush).toHaveBeenCalledWith(
    expect.stringContaining('/play?source=fixture&id=next')
  );
  expect(window.location.search).toBe('?source=fixture&id=old');
});

test('together from a movie detail preserves its source, title and year', () => {
  render(
    <VideoCard
      from='search'
      source='fixture'
      id='next'
      title='下一部'
      year='2026'
      detailOnTouch
    />
  );
  fireEvent.keyDown(screen.getByRole('button', { name: '查看 下一部' }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('button', { name: '一起看' }));
  const destination = new URL(mockPush.mock.calls[0][0], 'https://site.test');
  expect(destination.pathname).toBe('/watch-room');
  const film = new URL(
    destination.searchParams.get('film') || '/',
    'https://site.test'
  );
  expect(film.pathname).toBe('/play');
  expect(film.searchParams.get('source')).toBe('fixture');
  expect(film.searchParams.get('id')).toBe('next');
  expect(film.searchParams.get('title')).toBe('下一部');
  expect(film.searchParams.get('year')).toBe('2026');
});

test('together from a saved episode keeps that explicit episode for the room', () => {
  render(
    <VideoCard
      from='playrecord'
      source='fixture'
      id='next'
      title='剧集'
      currentEpisode={4}
      detailOnTouch
    />
  );
  fireEvent.keyDown(screen.getByRole('button', { name: '查看 剧集' }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('button', { name: '一起看' }));
  const destination = new URL(mockPush.mock.calls[0][0], 'https://site.test');
  const film = new URL(
    destination.searchParams.get('film') || '/',
    'https://site.test'
  );
  expect(film.searchParams.get('episode')).toBe('4');
});
