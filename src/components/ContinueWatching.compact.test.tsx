import { act, fireEvent, render, screen } from '@testing-library/react';

import ContinueWatching from './ContinueWatching';
import VideoCard from './VideoCard';

const mockPush = jest.fn();
const fixture = (title: string, save_time: number) => ({
  title,
  save_time,
  cover: '',
  year: '2026',
  source_name: '测试来源',
  total_episodes: 1,
  index: 1,
  play_time: 20,
  total_time: 100,
});
let mockRecords: Record<string, ReturnType<typeof fixture>>;
let mockUpdate: (records: typeof mockRecords) => void;
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/db.client', () => ({
  getCachedPlayRecordsSnapshot: () => mockRecords,
  getAllPlayRecords: async () => mockRecords,
  subscribeToDataUpdates: (event: string, listener: typeof mockUpdate) => {
    if (event === 'playRecordsUpdated') mockUpdate = listener;
    return jest.fn();
  },
  isFavorited: async () => false,
  generateStorageKey: (source: string, id: string) => `${source}+${id}`,
  clearAllPlayRecords: jest.fn(),
}));
jest.mock('@/components/AIChatPanel', () => () => null);
jest.mock('@/components/AnimeSubscribeModal', () => () => null);
jest.mock('@/components/DetailPanel', () => () => null);
jest.mock('@/components/feedback/ImageViewer', () => () => null);
jest.mock('@/components/feedback/MobileActionSheet', () => () => null);
jest.mock('@/components/TrailerPickerDialog', () => () => null);
jest.mock('@/components/PlayRecordsPanel', () => () => (
  <div role='dialog' aria-label='全部观看记录' />
));

beforeEach(() => {
  mockPush.mockReset();
  mockRecords = {
    'fixture+older': fixture('较早影片', 1),
    'fixture+newest': fixture('最新影片', 3),
  };
});

test('homepage shows the newest record and keeps full history reachable', async () => {
  const { container } = render(<ContinueWatching homeLayout />);
  await screen.findByRole('button', { name: '继续观看 最新影片' });
  expect(container.querySelectorAll('.tm-video-card')).toHaveLength(1);
  expect(screen.queryByText('较早影片')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查看全部' }));
  expect(
    screen.getByRole('dialog', { name: '全部观看记录' })
  ).toBeInTheDocument();
});

test('a record update promotes the next item and an empty update removes the section', async () => {
  render(<ContinueWatching homeLayout />);
  await screen.findByRole('button', { name: '继续观看 最新影片' });
  act(() => mockUpdate({ 'fixture+older': fixture('较早影片', 1) }));
  expect(
    screen.getByRole('button', { name: '继续观看 较早影片' })
  ).toBeInTheDocument();
  act(() => mockUpdate({}));
  expect(
    screen.queryByRole('heading', { name: '继续观看' })
  ).not.toBeInTheDocument();
});

test('compact record click and keyboard activation preserve the original playback destination', async () => {
  await act(async () => {
    render(
      <VideoCard
        compact
        orientation='horizontal'
        from='playrecord'
        source='fixture'
        id='episode'
        title='一部影片'
        year='2026'
        progress={20}
        playTime={20}
        totalTime={100}
      />
    );
  });
  const card = screen.getByRole('button', { name: '继续观看 一部影片' });
  expect(card).toHaveTextContent('看到 20%');
  fireEvent.click(card);
  expect(mockPush).toHaveBeenLastCalledWith(
    '/play?source=fixture&id=episode&title=%E4%B8%80%E9%83%A8%E5%BD%B1%E7%89%87&year=2026'
  );
  mockPush.mockClear();
  fireEvent.keyDown(card, { key: 'Enter' });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith(
    '/play?source=fixture&id=episode&title=%E4%B8%80%E9%83%A8%E5%BD%B1%E7%89%87&year=2026'
  );
});

test('compact live records keep their destination and do not invent viewing progress', async () => {
  await act(async () => {
    render(
      <VideoCard
        compact
        orientation='horizontal'
        from='playrecord'
        source='live_channel'
        id='live_42'
        origin='live'
        title='直播频道'
        progress={0}
      />
    );
  });
  const card = screen.getByRole('button', { name: '继续观看 直播频道' });
  expect(card).not.toHaveTextContent('看到 0%');
  fireEvent.keyDown(card, { key: ' ' });
  expect(mockPush).toHaveBeenCalledWith('/live?source=channel&id=42');
});
