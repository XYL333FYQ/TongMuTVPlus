import { fireEvent, render, screen } from '@testing-library/react';

import RoomMediaInfo from './RoomMediaInfo';

import type { PlayState } from '@/types/watch-room';

const state: PlayState = {
  type: 'play',
  url: '',
  currentTime: 0,
  isPlaying: true,
  videoId: 'first',
  videoName: '影片',
  source: 'catalog',
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('film synopsis can expand and collapse, and a new film starts collapsed', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ desc: '<p>影片介绍</p>'.repeat(60) }),
  });
  const view = render(<RoomMediaInfo roomId='room' state={state} queue={[]} />);
  const expand = await screen.findByRole('button', { name: '展开简介' });
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(
    document.getElementById(expand.getAttribute('aria-controls')!)
  ).toHaveTextContent('影片介绍');
  fireEvent.click(expand);
  expect(screen.getByRole('button', { name: '收起简介' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '收起简介' }));
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(expand);
  view.rerender(
    <RoomMediaInfo
      roomId='room'
      state={{ ...state, videoId: 'second' }}
      queue={[]}
    />
  );
  expect(
    await screen.findByRole('button', { name: '展开简介' })
  ).toHaveAttribute('aria-expanded', 'false');
  view.rerender(<RoomMediaInfo roomId='room' state={state} queue={[]} />);
  expect(
    await screen.findByRole('button', { name: '展开简介' })
  ).toHaveAttribute('aria-expanded', 'false');
});
