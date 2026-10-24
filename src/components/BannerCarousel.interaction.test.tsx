import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

import BannerCarousel from '@/components/BannerCarousel';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/tmdb.client', () => ({
  getGenreNames: () => [],
  getTMDBImageUrl: (path: string) => path,
}));
jest.mock('@/components/DetailPanel', () => () => null);
let mockRoomConnected = false;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () =>
    mockRoomConnected ? { currentRoom: { id: 'existing-room' } } : undefined,
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockRoomConnected = false;
  document.documentElement.dataset.tmReducedMotion = 'false';
  document.documentElement.dataset.tmPlaybackActive = 'false';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  localStorage.clear();
  localStorage.setItem(
    'banner_trending_cache_TX',
    JSON.stringify({
      timestamp: Date.now(),
      data: ['甲', '乙', '丙'].map((title, i) => ({
        id: i + 1,
        title,
        poster_path: '/' + i + '.jpg',
        backdrop_path: null,
        overview: '',
        genre_ids: [],
        vote_average: 0,
        release_date: '',
      })),
    })
  );
});

afterEach(() => {
  jest.useRealTimers();
});

test('covers advance every eight seconds even while an idle room is connected', () => {
  mockRoomConnected = true;
  render(<BannerCarousel />);
  act(() => jest.advanceTimersByTime(7999));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  act(() => jest.advanceTimersByTime(8000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('丙');
});

test('the visible progress counts down the same cycle that advances the cover', () => {
  render(<BannerCarousel />);
  act(() => jest.advanceTimersByTime(4000));
  const progress = screen.getByRole('progressbar', {
    name: '封面自动切换进度',
  });
  expect(Number(progress.getAttribute('aria-valuenow'))).toBeGreaterThan(45);
  expect(Number(progress.getAttribute('aria-valuenow'))).toBeLessThan(55);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  expect(Number(progress.getAttribute('aria-valuenow'))).toBe(0);
});

test('manual selection waits for twelve idle seconds then starts a fresh full cycle despite resting hover and focus', () => {
  render(<BannerCarousel />);
  act(() => jest.advanceTimersByTime(3000));
  const next = screen.getByRole('button', { name: '下一部推荐' });
  fireEvent.click(next);
  act(() => next.focus());
  fireEvent.mouseEnter(screen.getByRole('region', { name: '精选推荐' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  act(() => jest.advanceTimersByTime(12000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  act(() => jest.advanceTimersByTime(7999));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('丙');
  expect(next).toHaveFocus();
});

test('continued input restarts the idle wait instead of leaving a stale automatic timer', () => {
  render(<BannerCarousel />);
  fireEvent.click(screen.getByRole('button', { name: '下一部推荐' }));
  act(() => jest.advanceTimersByTime(11000));
  fireEvent.keyDown(screen.getByRole('region', { name: '精选推荐' }), {
    key: 'Shift',
  });
  act(() => jest.advanceTimersByTime(12000));
  act(() => jest.advanceTimersByTime(7999));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('丙');
});

test('returning from a hidden page starts a full cycle without catching up skipped slides', () => {
  render(<BannerCarousel />);
  act(() => jest.advanceTimersByTime(4000));
  act(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  act(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  act(() => jest.advanceTimersByTime(7999));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
});

test('active playback and the reduced-motion preference still suspend cover rotation', () => {
  render(<BannerCarousel />);
  act(() => {
    window.dispatchEvent(
      new CustomEvent('tm-playback-state', { detail: { active: true } })
    );
  });
  act(() => jest.advanceTimersByTime(20000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  act(() => {
    document.documentElement.dataset.tmReducedMotion = 'true';
    window.dispatchEvent(
      new CustomEvent('tm-visual-preferences-change', {
        detail: { reduceMotion: true, noBlur: false },
      })
    );
    window.dispatchEvent(
      new CustomEvent('tm-playback-state', { detail: { active: false } })
    );
  });
  act(() => jest.advanceTimersByTime(20000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('strict-mode effect replay does not create two advancing clocks', () => {
  render(
    <StrictMode>
      <BannerCarousel />
    </StrictMode>
  );
  act(() => jest.advanceTimersByTime(8000));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
});

test('a mostly vertical touch scroll does not change the selected film', () => {
  render(<BannerCarousel />);
  const hero = screen.getByRole('region', { name: '精选推荐' });
  fireEvent.touchStart(hero, { touches: [{ clientX: 300, clientY: 100 }] });
  fireEvent.touchMove(hero, { touches: [{ clientX: 210, clientY: 450 }] });
  fireEvent.touchEnd(hero);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('甲');
});

test('a horizontal swipe starting at the left screen edge can select the previous film', () => {
  render(<BannerCarousel />);
  const hero = screen.getByRole('region', { name: '精选推荐' });
  fireEvent.touchStart(hero, { touches: [{ clientX: 0, clientY: 200 }] });
  fireEvent.touchMove(hero, { touches: [{ clientX: 90, clientY: 205 }] });
  fireEvent.touchEnd(hero);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('丙');
});

test('a horizontal swipe keeps the existing next-film action', () => {
  render(<BannerCarousel />);
  const hero = screen.getByRole('region', { name: '精选推荐' });
  fireEvent.touchStart(hero, { touches: [{ clientX: 300, clientY: 200 }] });
  fireEvent.touchMove(hero, { touches: [{ clientX: 210, clientY: 216 }] });
  fireEvent.touchEnd(hero);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('乙');
});
