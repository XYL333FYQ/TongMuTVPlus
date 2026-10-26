jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => MockPlaybackSurface,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('./useAudioFocus', () => ({
  useAudioFocus: () => mockAudioFocus,
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect, useRef } from 'react';

import { usePlaybackSession } from './context';
import PlaybackSessionProvider from './PlaybackSessionProvider';

import type { PlayState } from '@/types/watch-room';

const FILM_A = '/play?source=fixture&id=film-a&episode=1';
const FILM_B = '/play?source=fixture&id=film-b&episode=1';
let mockPathname = '/play';
let mockMounts = 0;
let mockUnmounts = 0;
let mockController: {
  play: jest.Mock;
  pause: jest.Mock;
} | null = null;
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockAudioFocus = { ownsSound: true, claimSound: jest.fn() };

function roomState(videoId = 'film-a'): PlayState {
  return {
    type: 'play',
    source: 'fixture',
    videoId,
    videoName: videoId,
    episode: 1,
    url: 'https://media.test/video.m3u8',
    currentTime: 12,
    isPlaying: true,
  };
}

function makeRoom() {
  const emit = jest.fn();
  return {
    currentRoom: {
      id: 'room-1',
      name: '测试房间',
      revision: 7,
      currentState: roomState(),
    },
    canControl: true,
    isConnected: true,
    roomCommand: jest.fn<Promise<void>, [string, { following: boolean }]>(() =>
      Promise.resolve()
    ),
    socket: { connected: true, timeout: jest.fn(() => ({ emit })) },
  };
}
let mockRoom: ReturnType<typeof makeRoom> | null = null;

// This intentionally does not load media: these are React lifetime and command-order tests.
function MockPlaybackSurface() {
  const session = usePlaybackSession();
  const video = useRef<HTMLVideoElement>(null);
  const attachController = session.attachController;
  useEffect(() => {
    mockMounts += 1;
    if (!video.current)
      throw new Error('The test playback video was not mounted');
    mockController = { play: jest.fn(), pause: jest.fn() };
    attachController({
      video: video.current,
      currentTime: 12,
      playing: true,
      muted: false,
      playbackRate: 1,
      ...mockController,
    });
    return () => {
      mockUnmounts += 1;
      attachController(null);
    };
  }, [attachController]);
  return (
    <div data-tm-player-mount data-testid='player-mount'>
      <video
        ref={video}
        data-testid='session-video'
        data-playback-href={session.href || ''}
      />
    </div>
  );
}

function Probe({ dock = false }: { dock?: boolean }) {
  const session = usePlaybackSession();
  return (
    <>
      <button onClick={() => session.requestPlayback(FILM_A)}>
        选择影片 A
      </button>
      <button onClick={() => session.requestPlayback(FILM_B)}>
        选择影片 B
      </button>
      <button
        onClick={() =>
          session.requestPlayback(`${FILM_A}&title=新标题&year=2025`)
        }
      >
        更新影片显示信息
      </button>
      <button onClick={session.minimize}>测试收起</button>
      <button onClick={session.restore}>测试恢复</button>
      <button onClick={session.enterPersonalViewing}>测试个人观看</button>
      <button
        onClick={() =>
          session.setMetadata({ title: '影片 A', error: '网络暂时断开' })
        }
      >
        模拟影片加载失败
      </button>
      <output data-testid='session-following'>
        {String(session.followingRoom)}
      </output>
      <output data-testid='session-href'>{session.href}</output>
      {dock && (
        <div ref={session.registerSlot} data-testid='room-playback-slot' />
      )}
    </>
  );
}

function Harness({ dock = false }: { dock?: boolean }) {
  return (
    <PlaybackSessionProvider>
      <Probe dock={dock} />
    </PlaybackSessionProvider>
  );
}

function deferred() {
  let resolve: () => void = () => {
    throw new Error('deferred promise was not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('uses the existing personal choice for the current film after acknowledgement without remounting', async () => {
  mockPathname = '/watch-room';
  mockRoom = makeRoom();
  const acknowledgement = deferred();
  mockRoom.roomCommand.mockReturnValueOnce(acknowledgement.promise);
  render(<Harness dock />);
  const video = await screen.findByTestId('session-video');
  const href = screen.getByTestId('session-href').textContent;
  fireEvent.click(screen.getByRole('button', { name: '测试个人观看' }));
  expect(mockRoom.roomCommand).toHaveBeenCalledWith('room:following', {
    following: false,
  });
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
  await act(async () => acknowledgement.resolve());
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  expect(screen.getByTestId('session-href')).toHaveTextContent(href || '');
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(mockMounts).toBe(1);
  expect(mockUnmounts).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '回到一起看' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-following')).toHaveTextContent('true')
  );
  expect(screen.getByTestId('session-video')).toBe(video);
});

it('folds through the room corner icon independently from personal viewing', async () => {
  mockPathname = '/watch-room';
  mockRoom = makeRoom();
  render(<Harness dock />);
  const video = await screen.findByTestId('session-video');
  const button = screen.getByRole('button', { name: '收起画面' });
  expect(button).toHaveAttribute('title', '收起画面，继续播放');
  fireEvent.click(button);
  expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
    'data-presentation',
    'folded'
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  expect(screen.getByTestId('session-video')).toBe(video);
});

it('keeps the docked player aligned when an inner page container scrolls without remounting media', async () => {
  mockPathname = '/watch-room';
  render(<Harness dock />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const host = await screen.findByTestId('global-playback-host');
  const video = screen.getByTestId('session-video');
  const slot = screen.getByTestId('room-playback-slot');
  const getRect = jest.spyOn(slot, 'getBoundingClientRect');
  getRect.mockReturnValue({
    left: 20,
    top: -120,
    width: 600,
    height: 337.5,
  } as DOMRect);
  // Element scroll events do not bubble. BODY is the actual scrolling container in the browser proof.
  fireEvent.scroll(document.body, { bubbles: false });
  await waitFor(() =>
    expect(host.style.getPropertyValue('--tm-slot-top')).toBe('-120px')
  );
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(mockMounts).toBe(1);
  expect(mockUnmounts).toBe(0);
  getRect.mockRestore();
});

it('offers an explicit sound takeover while the player is docked in a room', async () => {
  mockPathname = '/watch-room';
  mockAudioFocus.ownsSound = false;
  render(<Harness dock />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  await waitFor(() =>
    expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
      'data-presentation',
      'docked'
    )
  );
  expect(mockAudioFocus.claimSound).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: '另一标签页正在出声 · 在这里听' })
  );
  expect(mockAudioFocus.claimSound).toHaveBeenCalledTimes(1);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/play';
  mockMounts = 0;
  mockUnmounts = 0;
  mockController = null;
  mockRoom = null;
  mockAudioFocus.ownsSound = true;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => 'qa-command-id' },
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {
        /* layout is measured synchronously by the real provider */
      }
      disconnect() {
        /* no external observer remains */
      }
    },
  });
});

it.each(['docked', 'mini', 'folded'] as const)(
  'offers a local reload after a media failure in %s presentation without changing the room or film',
  async (presentation) => {
    mockPathname = '/watch-room';
    mockRoom = makeRoom();
    render(<Harness dock={presentation === 'docked'} />);
    const original = await screen.findByTestId('session-video');
    const originalHref = screen.getByTestId('session-href').textContent;
    if (presentation === 'folded')
      fireEvent.click(screen.getByRole('button', { name: '测试收起' }));
    await waitFor(() =>
      expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
        'data-presentation',
        presentation
      )
    );
    fireEvent.click(screen.getByRole('button', { name: '模拟影片加载失败' }));
    expect(screen.getByRole('alert')).toHaveTextContent('网络暂时断开');
    fireEvent.click(screen.getByRole('button', { name: '重新加载影片' }));
    await waitFor(() =>
      expect(screen.getByTestId('session-video')).not.toBe(original)
    );
    expect(original.isConnected).toBe(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-href').textContent).toBe(originalHref);
    expect(screen.getByTestId('session-following')).toHaveTextContent('true');
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    expect(mockRoom.socket.timeout().emit).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockMounts).toBe(2);
  }
);

it('keeps the same video across page navigation, mini view, docking, folding and restoring', async () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const video = screen.getByTestId('session-video') as HTMLVideoElement;
  video.currentTime = 37;
  expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
    'data-presentation',
    'full'
  );
  for (const pathname of ['/search', '/my', '/watch-room']) {
    mockPathname = pathname;
    view.rerender(<Harness />);
    expect(screen.getByTestId('session-video')).toBe(video);
    expect(video.currentTime).toBe(37);
    expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
      'data-presentation',
      'mini'
    );
  }
  view.rerender(<Harness dock />);
  await waitFor(() =>
    expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
      'data-presentation',
      'docked'
    )
  );
  fireEvent.click(screen.getByRole('button', { name: '测试收起' }));
  expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
    'data-presentation',
    'folded'
  );
  fireEvent.click(screen.getByRole('button', { name: '测试恢复' }));
  expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
    'data-presentation',
    'docked'
  );
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(video.currentTime).toBe(37);
  expect(mockMounts).toBe(1);
  expect(mockUnmounts).toBe(0);
});

it('rebuilds the surface for an explicit different film, while a display-only URL update keeps its instance', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const firstVideo = screen.getByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '更新影片显示信息' }));
  expect(screen.getByTestId('session-video')).toBe(firstVideo);
  expect(mockMounts).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  expect(screen.getByTestId('session-video')).not.toBe(firstVideo);
  expect(firstVideo.isConnected).toBe(false);
  expect(mockMounts).toBe(2);
  expect(mockUnmounts).toBe(1);
});

it('adds a selection to the room queue without replacing the playing film, before or after its ACK', async () => {
  mockRoom = makeRoom();
  const room = mockRoom;
  render(<Harness />);
  const video = await screen.findByTestId('session-video');
  const currentHref = screen.getByTestId('session-href').textContent;
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  fireEvent.click(screen.getByRole('button', { name: /加入房间片单/ }));
  const emit = room.socket.timeout().emit;
  expect(emit).toHaveBeenCalledWith(
    'queue:add',
    expect.objectContaining({
      videoId: 'film-b',
      source: 'fixture',
      baseRevision: 7,
    }),
    expect.any(Function)
  );
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(screen.getByTestId('session-href')).toHaveTextContent(
    currentHref || ''
  );
  await act(async () => {
    emit.mock.calls[0][2](null, { success: true });
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(screen.getByTestId('session-href')).toHaveTextContent(
    currentHref || ''
  );
  expect(mockRouter.replace).toHaveBeenCalledWith(currentHref);
  expect(room.roomCommand).not.toHaveBeenCalled();
  expect(mockMounts).toBe(1);
});

it('waits for room:following ACK before personal playback and again before rejoining the latest room film', async () => {
  mockRoom = makeRoom();
  const room = mockRoom;
  const leaveAck = deferred();
  const joinAck = deferred();
  room.roomCommand.mockImplementation((_event, payload) =>
    payload.following ? joinAck.promise : leaveAck.promise
  );
  const view = render(<Harness />);
  const roomVideo = await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  fireEvent.click(screen.getByRole('button', { name: /仅自己看/ }));
  expect(room.roomCommand).toHaveBeenCalledWith('room:following', {
    following: false,
  });
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
  expect(screen.getByTestId('session-video')).toBe(roomVideo);
  expect(screen.getByTestId('session-href').textContent).toContain('id=film-a');
  await act(async () => {
    leaveAck.resolve();
  });
  const personalVideo = screen.getByTestId('session-video');
  expect(personalVideo).not.toBe(roomVideo);
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  expect(screen.getByTestId('session-href').textContent).toContain('id=film-b');
  room.currentRoom.currentState = roomState('film-c');
  view.rerender(<Harness />);
  expect(screen.getByTestId('session-video')).toBe(personalVideo);
  fireEvent.click(screen.getByRole('button', { name: /回到一起看/ }));
  expect(room.roomCommand).toHaveBeenLastCalledWith('room:following', {
    following: true,
  });
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  expect(screen.getByTestId('session-video')).toBe(personalVideo);
  expect(screen.getByTestId('session-href').textContent).toContain('id=film-b');
  await act(async () => {
    joinAck.resolve();
  });
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
  expect(screen.getByTestId('session-href').textContent).toContain('id=film-c');
  expect(screen.getByTestId('session-video')).not.toBe(personalVideo);
  expect(mockMounts).toBe(3);
});

it('keeps the current room video and surfaces an error when leaving synchronization is rejected', async () => {
  mockRoom = makeRoom();
  mockRoom.roomCommand.mockRejectedValueOnce(new Error('主持状态已改变'));
  render(<Harness />);
  const video = await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  fireEvent.click(screen.getByRole('button', { name: /仅自己看/ }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('主持状态已改变')
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(screen.getByTestId('session-href').textContent).toContain('id=film-a');
  expect(mockMounts).toBe(1);
});

it('closes a solo mini player completely instead of only folding it', async () => {
  mockPathname = '/search';
  mockRoom = null;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const host = await screen.findByTestId('global-playback-host');
  expect(host).toHaveAttribute('data-presentation', 'mini');

  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));

  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
  expect(screen.getByTestId('session-href')).toBeEmptyDOMElement();
  expect(mockUnmounts).toBe(1);
});

it('folded player can also be closed', async () => {
  mockPathname = '/search';
  mockRoom = null;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  await screen.findByTestId('global-playback-host');
  fireEvent.click(screen.getByRole('button', { name: '测试收起' }));
  expect(screen.getByTestId('global-playback-host')).toHaveAttribute(
    'data-presentation',
    'folded'
  );

  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));

  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
});

it('closing while following a room leaves the sync first and offers the way back', async () => {
  mockPathname = '/search';
  mockRoom = makeRoom();
  render(<Harness />);
  await screen.findByTestId('global-playback-host');

  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));

  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
  expect(mockRoom.roomCommand).toHaveBeenCalledWith('room:following', {
    following: false,
  });
  expect(
    screen.getByRole('button', { name: /回到一起看/ })
  ).toBeInTheDocument();
});

it('keeps playing when leaving the room sync fails', async () => {
  mockPathname = '/search';
  mockRoom = makeRoom();
  mockRoom.roomCommand.mockRejectedValueOnce(new Error('房间连接中断'));
  render(<Harness />);
  await screen.findByTestId('global-playback-host');

  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('房间连接中断');
  expect(screen.getByTestId('global-playback-host')).toBeInTheDocument();
});

it('a deleted room ends the playback of people still following it, but not personal viewers', async () => {
  mockPathname = '/search';
  mockRoom = makeRoom();
  render(<Harness />);
  await screen.findByTestId('global-playback-host');

  act(() => {
    window.dispatchEvent(
      new CustomEvent('tongmu:room-deleted', { detail: { roomId: 'room-1' } })
    );
  });

  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
});

it('a deleted room does not hollow out the /play page itself', async () => {
  mockPathname = '/play';
  mockRoom = makeRoom();
  render(<Harness />);
  await screen.findByTestId('global-playback-host');

  act(() => {
    window.dispatchEvent(new CustomEvent('tongmu:room-deleted'));
  });

  expect(screen.getByTestId('global-playback-host')).toBeInTheDocument();
});

it('while scrolling the docked player follows the page without easing, then restores the transition', async () => {
  mockPathname = '/watch-room';
  render(<Harness dock />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const host = await screen.findByTestId('global-playback-host');
  const mount = screen.getByTestId('player-mount');
  const slot = screen.getByTestId('room-playback-slot');
  const getRect = jest.spyOn(slot, 'getBoundingClientRect');
  getRect.mockReturnValue({
    left: 20,
    top: -40,
    width: 600,
    height: 337.5,
  } as DOMRect);

  fireEvent.scroll(window);

  expect(mount.style.transition).toBe('none');
  await waitFor(() =>
    expect(host.style.getPropertyValue('--tm-slot-top')).toBe('-40px')
  );
  await waitFor(() => expect(mount.style.transition).toBe(''), {
    timeout: 1000,
  });
  getRect.mockRestore();
});

it('keeps the easing transition when the user opted into eased following', async () => {
  mockPathname = '/watch-room';
  document.documentElement.dataset.tmPlayerEase = 'true';
  render(<Harness dock />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  await screen.findByTestId('global-playback-host');
  const mount = screen.getByTestId('player-mount');

  fireEvent.scroll(window);

  expect(mount.style.transition).toBe('');
  delete document.documentElement.dataset.tmPlayerEase;
});

it('the mini player has its own play/pause button that follows the video state', async () => {
  mockPathname = '/search';
  mockRoom = null;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 A' }));
  const video = (await screen.findByTestId(
    'session-video'
  )) as HTMLVideoElement;
  // jsdom 不真的播放：自己指定 paused，再发事件，和浏览器的行为一致
  let paused = false;
  Object.defineProperty(video, 'paused', { get: () => paused });
  act(() => {
    video.dispatchEvent(new Event('play'));
  });

  fireEvent.click(screen.getByRole('button', { name: '暂停' }));
  expect(mockController?.pause).toHaveBeenCalledTimes(1);

  paused = true;
  act(() => {
    video.dispatchEvent(new Event('pause'));
  });
  const play = await screen.findByRole('button', { name: '播放' });
  fireEvent.click(play);
  expect(mockController?.play).toHaveBeenCalledTimes(1);
});

it('a room member without control cannot pause locally from the mini player', async () => {
  mockPathname = '/search';
  mockRoom = { ...makeRoom(), canControl: false };
  render(<Harness />);
  await screen.findByTestId('global-playback-host');
  const button = screen.getByRole('button', { name: '播放进度由房主控制' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(mockController?.pause).not.toHaveBeenCalled();
});
