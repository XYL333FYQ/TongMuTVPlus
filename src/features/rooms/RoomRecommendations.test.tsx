import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { getDoubanCategories } from '@/lib/douban.client';

import RoomMediaInfo from './RoomMediaInfo';
import RoomQuickStart from './RoomQuickStart';

import type { PlayState } from '@/types/watch-room';

jest.mock('@/lib/douban.client', () => ({ getDoubanCategories: jest.fn() }));

jest.mock('@/components/catalog/PublicPoster', () => ({
  __esModule: true,
  default: () => null,
}));

const originalFetch = global.fetch;
const originalResizeObserver = Object.getOwnPropertyDescriptor(
  global,
  'ResizeObserver'
);
let measuredColumns = 4;
let notifyResize: () => void;
const disconnectResize = jest.fn();

beforeEach(() => {
  measuredColumns = 4;
  notifyResize = () => undefined;
  Object.defineProperty(global, 'ResizeObserver', {
    configurable: true,
    value: jest.fn((callback) => {
      notifyResize = () => callback([]);
      return { observe: jest.fn(), disconnect: disconnectResize };
    }),
  });
  const nativeGetComputedStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = nativeGetComputedStyle(element);
    const nativeGetPropertyValue = style.getPropertyValue.bind(style);
    style.getPropertyValue = (property) =>
      element.classList.contains('tm-room-recommendations') &&
      property === '--tm-room-recommendation-columns'
        ? String(measuredColumns)
        : nativeGetPropertyValue(property);
    return style;
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  localStorage.removeItem('homepage_movies');
  for (const source of ['Douban', 'TMDB', 'TX']) {
    localStorage.removeItem(`banner_trending_cache_${source}`);
  }
  jest.restoreAllMocks();
  jest.clearAllMocks();
  if (originalResizeObserver) {
    Object.defineProperty(global, 'ResizeObserver', originalResizeObserver);
  } else {
    Reflect.deleteProperty(global, 'ResizeObserver');
  }
});

test('one row follows the container capacity and keeps the same film order through resizing', async () => {
  measuredColumns = 6;
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: Array.from({ length: 18 }, (_, index) => ({
      id: String(index),
      title: `自适应影片 ${index}`,
    })),
  });
  const onChoose = jest.fn();
  const view = render(<RoomQuickStart onChoose={onChoose} />);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /^选择 自适应影片 / })
    ).toHaveLength(6)
  );
  const names = () =>
    screen
      .getAllByRole('button', { name: /^选择 自适应影片 / })
      .map((card) => card.getAttribute('aria-label'));
  const desktop = names();
  measuredColumns = 3;
  act(() => notifyResize());
  expect(names()).toEqual(desktop.slice(0, 3));
  measuredColumns = 4;
  act(() => notifyResize());
  expect(names()).toEqual(desktop.slice(0, 4));
  measuredColumns = 6;
  act(() => notifyResize());
  expect(names()).toEqual(desktop);
  expect(getDoubanCategories).toHaveBeenCalledTimes(1);
  expect(onChoose).not.toHaveBeenCalled();
  view.unmount();
  expect(disconnectResize).toHaveBeenCalledTimes(1);
});

test('refresh fills the current six-card row with different films without refetching', async () => {
  measuredColumns = 6;
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: Array.from({ length: 18 }, (_, index) => ({
      id: String(index),
      title: `整行影片 ${index}`,
    })),
  });
  render(<RoomQuickStart onChoose={jest.fn()} />);
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: /^选择 整行影片 / })
    ).toHaveLength(6)
  );
  const before = screen
    .getAllByRole('button', { name: /^选择 整行影片 / })
    .map((card) => card.getAttribute('aria-label'));
  fireEvent.click(screen.getByRole('button', { name: '随机换一批推荐' }));
  const after = screen.getAllByRole('button', { name: /^选择 整行影片 / });
  expect(after).toHaveLength(6);
  expect(
    after.every((card) => !before.includes(card.getAttribute('aria-label')))
  ).toBe(true);
  expect(getDoubanCategories).toHaveBeenCalledTimes(1);
});

test('four random catalog recommendations open the existing picker with the chosen title', async () => {
  const onChoose = jest.fn();
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      title: `推荐 ${index}`,
      year: '2026',
    })),
  });
  render(<RoomQuickStart onChoose={onChoose} />);
  const cards = await screen.findAllByRole('button', { name: /^选择 推荐 / });
  expect(cards).toHaveLength(4);
  expect(new Set(cards.map((card) => card.textContent)).size).toBe(4);
  expect(onChoose).not.toHaveBeenCalled();
  const chosenTitle = cards[0].getAttribute('aria-label')?.replace('选择 ', '');
  fireEvent.click(cards[0]);
  expect(onChoose).toHaveBeenCalledWith(chosenTitle);
});

test('random batches exclude featured films and replace all four when enough alternatives exist', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  localStorage.setItem(
    'banner_trending_cache_Douban',
    JSON.stringify({ data: [{ id: 123, title: ' 首页精选 ' }] })
  );
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: [
      { id: '123', title: '首页精选' },
      ...Array.from({ length: 12 }, (_, index) => ({
        id: String(index),
        title: `随机影片 ${index}`,
      })),
    ],
  });
  const onChoose = jest.fn();
  render(<RoomQuickStart onChoose={onChoose} />);
  const first = await screen.findAllByRole('button', { name: /^选择 / });
  expect(first).toHaveLength(4);
  expect(screen.queryByRole('button', { name: '选择 首页精选' })).toBeNull();
  const firstTitles = first.map((card) => card.getAttribute('aria-label'));
  fireEvent.click(screen.getByRole('button', { name: '随机换一批推荐' }));
  const second = screen.getAllByRole('button', { name: /^选择 / });
  expect(second).toHaveLength(4);
  expect(
    second.every(
      (card) => !firstTitles.includes(card.getAttribute('aria-label'))
    )
  ).toBe(true);
  expect(getDoubanCategories).toHaveBeenCalledTimes(1);
  expect(getDoubanCategories).toHaveBeenCalledWith(
    expect.objectContaining({ pageStart: 20, pageLimit: 60 })
  );
  expect(onChoose).not.toHaveBeenCalled();
});

test('duplicate and invalid candidates cannot repeat cards and a short pool prefers new films', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0);
  (getDoubanCategories as jest.Mock).mockResolvedValue({
    code: 200,
    list: [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        title: `短片单 ${index}`,
      })),
      { id: '0', title: '短片单 0' },
      { id: 'another-id', title: ' 短片单 0 ' },
      null,
      { id: 'invalid', title: '' },
    ],
  });
  render(<RoomQuickStart onChoose={jest.fn()} />);
  const first = await screen.findAllByRole('button', { name: /^选择 / });
  expect(first).toHaveLength(4);
  const firstTitles = first.map((card) => card.getAttribute('aria-label'));
  fireEvent.click(screen.getByRole('button', { name: '随机换一批推荐' }));
  const secondTitles = screen
    .getAllByRole('button', { name: /^选择 / })
    .map((card) => card.getAttribute('aria-label'));
  expect(new Set(secondTitles).size).toBe(4);
  expect(secondTitles.some((title) => !firstTitles.includes(title))).toBe(true);
});

test('failed recommendations can retry and a full short pool disables meaningless shuffling', async () => {
  (getDoubanCategories as jest.Mock)
    .mockRejectedValueOnce(new Error('upstream unavailable'))
    .mockResolvedValueOnce({
      code: 200,
      list: [{ id: '1', title: '唯一影片' }],
    });
  render(<RoomQuickStart onChoose={jest.fn()} />);
  fireEvent.click(
    await screen.findByRole('button', { name: '重新加载随机推荐' })
  );
  await screen.findByRole('button', { name: '选择 唯一影片' });
  expect(screen.getByRole('button', { name: '随机换一批推荐' })).toBeDisabled();
  expect(getDoubanCategories).toHaveBeenCalledTimes(2);
});

test('existing home recommendations remain usable when upstream refresh fails', async () => {
  localStorage.setItem(
    'homepage_movies',
    JSON.stringify({
      timestamp: Date.now(),
      data: [{ id: '12', title: '缓存影片', poster: '', year: '', rate: '' }],
    })
  );
  (getDoubanCategories as jest.Mock).mockRejectedValue(
    new Error('upstream unavailable')
  );
  render(<RoomQuickStart onChoose={jest.fn()} />);
  expect(
    await screen.findByRole('button', { name: '选择 缓存影片' })
  ).toBeInTheDocument();
  expect(screen.queryByText('推荐影片暂时无法获取')).not.toBeInTheDocument();
});

test('cached fallback excludes cross-source featured films even when another featured cache is damaged', async () => {
  localStorage.setItem('banner_trending_cache_Douban', '{broken');
  localStorage.setItem(
    'banner_trending_cache_TMDB',
    JSON.stringify({ data: [{ id: 999, title: '精选影片' }] })
  );
  localStorage.setItem(
    'homepage_movies',
    JSON.stringify({
      data: [
        { id: '11', title: ' 精选影片 ' },
        { id: '12', title: '缓存影片' },
      ],
    })
  );
  (getDoubanCategories as jest.Mock).mockRejectedValue(
    new Error('upstream unavailable')
  );
  render(<RoomQuickStart onChoose={jest.fn()} />);
  await screen.findByText('推荐更新失败，暂时显示缓存影片');
  expect(screen.getAllByRole('button', { name: /^选择 / })).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: '选择 缓存影片' })
  ).toBeInTheDocument();
});

test('refresh stays disabled until the background pool finishes loading', async () => {
  let finish: (value: unknown) => void = () => undefined;
  (getDoubanCategories as jest.Mock).mockImplementation(
    () => new Promise((resolve) => (finish = resolve))
  );
  render(<RoomQuickStart onChoose={jest.fn()} />);
  expect(screen.getByRole('button', { name: '随机换一批推荐' })).toBeDisabled();
  await act(async () => {
    finish({
      code: 200,
      list: Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        title: `影片 ${index}`,
      })),
    });
  });
  expect(screen.getByRole('button', { name: '随机换一批推荐' })).toBeEnabled();
});

test('late film descriptions cannot overwrite the newly selected film', async () => {
  const responses: Array<(response: Response) => void> = [];
  global.fetch = jest.fn(
    () => new Promise<Response>((resolve) => responses.push(resolve))
  );
  const state: PlayState = {
    type: 'play',
    url: '',
    currentTime: 0,
    isPlaying: false,
    source: 'test',
    videoId: 'first',
    videoName: '第一部',
  };
  const view = render(<RoomMediaInfo roomId='room' state={state} queue={[]} />);
  view.rerender(
    <RoomMediaInfo
      roomId='room'
      state={{ ...state, videoId: 'second' }}
      queue={[]}
    />
  );
  await act(async () =>
    responses[1]({
      ok: true,
      json: async () => ({ desc: '<p>第二部简介</p>' }),
    } as Response)
  );
  await screen.findByText('第二部简介');
  await act(async () =>
    responses[0]({
      ok: true,
      json: async () => ({ desc: '旧简介' }),
    } as Response)
  );
  await waitFor(() =>
    expect(screen.queryByText('旧简介')).not.toBeInTheDocument()
  );
  expect(screen.getByText('第二部简介')).toBeInTheDocument();
  view.rerender(
    <RoomMediaInfo
      roomId='room'
      state={{ ...state, source: 'directplay' }}
      queue={[]}
    />
  );
  expect(screen.getByText('暂无影片简介')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
