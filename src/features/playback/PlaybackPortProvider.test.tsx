import { fireEvent, render, screen } from '@testing-library/react';
import {
  PlaybackPortProvider,
  usePlaybackPort,
  usePlaybackMediaDetail,
} from './PlaybackPortProvider';
import type { SearchResult } from '@/lib/types';
import { PlaybackSessionContext, type PlaybackSession } from './context';

function Consumer() {
  const port = usePlaybackPort();
  return (
    <button
      onClick={() => {
        void port?.load({ href: '/play?source=test&id=film' });
      }}
    >
      load
    </button>
  );
}
test('an explicit media selection can supply resolved detail without leaking it into personal browsing', async () => {
  const detail = {
    source: 'test',
    id: 'film',
    title: 'Selected film',
    episodes: ['/safe-gateway'],
  } as SearchResult;
  function Selection() {
    const port = usePlaybackPort();
    const override = usePlaybackMediaDetail();
    return (
      <>
        <button
          onClick={() => {
            void port?.load({
              href: '/play?source=test&id=film&mediaRef=ref',
              detail,
            });
          }}
        >
          select
        </button>
        <span>{override?.title || 'none'}</span>
      </>
    );
  }
  const session = {
    href: '/play?source=test&id=film&mediaRef=ref',
    controller: null,
    requestPlayback: jest.fn(),
  } as unknown as PlaybackSession;
  const { rerender } = render(
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackPortProvider>
        <Selection />
      </PlaybackPortProvider>
    </PlaybackSessionContext.Provider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'select' }));
  expect(screen.getByText('Selected film')).toBeInTheDocument();
  rerender(
    <PlaybackSessionContext.Provider
      value={{ ...session, href: '/play?source=test&id=other' }}
    >
      <PlaybackPortProvider>
        <Selection />
      </PlaybackPortProvider>
    </PlaybackSessionContext.Provider>
  );
  expect(screen.getByText('none')).toBeInTheDocument();
});
test('the root port delegates selection and attaches the existing controller without replacing children', () => {
  const requestPlayback = jest.fn();
  const session = {
    requestPlayback,
    controller: null,
  } as unknown as PlaybackSession;
  const { rerender } = render(
    <PlaybackSessionContext.Provider value={session}>
      <PlaybackPortProvider>
        <Consumer />
      </PlaybackPortProvider>
    </PlaybackSessionContext.Provider>
  );
  const button = screen.getByRole('button');
  button.click();
  expect(requestPlayback).toHaveBeenCalledWith(
    '/play?source=test&id=film',
    'user'
  );
  rerender(
    <PlaybackSessionContext.Provider value={{ ...session }}>
      <PlaybackPortProvider>
        <Consumer />
      </PlaybackPortProvider>
    </PlaybackSessionContext.Provider>
  );
  expect(screen.getByRole('button')).toBe(button);
});
