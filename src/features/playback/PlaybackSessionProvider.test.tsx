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
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'viewer' }),
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
    roomCommand: jest.fn<Promise<void>, [string, Record<string, unknown>]>(() =>
      Promise.resolve()
    ),
    socket: { connected: true, timeout: jest.fn(() => ({ emit })) },
  };
}
let mockRoom: ReturnType<typeof makeRoom> | null = null;
let mockPersonalResult: unknown;

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
      <button onClick={() => session.requestPlayback(FILM_B, 'personal')}>
        明确自己看 B
      </button>
      <button onClick={() => session.requestPlayback(FILM_A, 'personal')}>
        明确自己看 A
      </button>
      <button onClick={() => session.requestPlayback(FILM_B, 'together')}>
        明确一起看 B
      </button>
      <button onClick={() => session.shareCurrentPlayback('room-2')}>
        分享到新房间
      </button>
      <button onClick={() => session.updateHref(`${FILM_A}&title=迟到资料`)}>
        旧播放器补资料
      </button>
      <output data-testid='room-selection'>{session.roomSelectionHref}</output>
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
        onClick={async () => {
          mockPersonalResult = await session.enterPersonalViewing();
        }}
      >
        测试个人观看返回结果
      </button>
      <button onClick={session.resumeRoom}>测试恢复一起看</button>
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
  fireEvent.click(screen.getByRole('button', { name: '测试恢复一起看' }));
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
  localStorage.clear();
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
  const queued = deferred();
  room.roomCommand.mockReturnValue(queued.promise);
  render(<Harness />);
  const video = await screen.findByTestId('session-video');
  const currentHref = screen.getByTestId('session-href').textContent;
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  fireEvent.click(screen.getByRole('button', { name: /加入房间片单/ }));
  expect(room.roomCommand).toHaveBeenCalledWith(
    'queue:add',
    expect.objectContaining({
      videoId: 'film-b',
      source: 'fixture',
      roomId: 'room-1',
    })
  );
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(screen.getByTestId('session-href')).toHaveTextContent(
    currentHref || ''
  );
  await act(async () => {
    queued.resolve();
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('session-video')).toBe(video);
  expect(screen.getByTestId('session-href')).toHaveTextContent(
    currentHref || ''
  );
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(room.socket.timeout().emit).not.toHaveBeenCalled();
  expect(mockMounts).toBe(1);
});

it('keeps an explicit personal selection when an old room arrives after the selection', async () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '明确自己看 B' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b')
  );
  mockRoom = makeRoom();
  view.rerender(<Harness />);
  await waitFor(() =>
    expect(mockRoom?.roomCommand).toHaveBeenCalledWith('room:following', {
      following: false,
    })
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b');
  expect(screen.getByTestId('room-selection')).toBeEmptyDOMElement();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('an already personal viewer can select another personal film while the room connection is offline', async () => {
  mockRoom = makeRoom();
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '明确自己看 B' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-following')).toHaveTextContent('false')
  );
  mockRoom.isConnected = false;
  mockRoom.roomCommand.mockRejectedValue(new Error('连接中断'));
  fireEvent.click(screen.getByRole('button', { name: '明确自己看 A' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-a')
  );
  expect(mockRoom.roomCommand).toHaveBeenCalledTimes(1);
});

it('room selection pages provide their own return link instead of a duplicate floating return', () => {
  mockPathname = '/watch-room/select';
  mockRoom = makeRoom();
  render(<Harness />);
  expect(
    screen.queryByRole('link', { name: /返回房间/ })
  ).not.toBeInTheDocument();
});

it('personal viewing removes the former room queue item without remounting the film', async () => {
  mockRoom = makeRoom();
  mockRoom.currentRoom.currentState.queueItemId = 'old-room-item';
  render(<Harness />);
  const video = await screen.findByTestId('session-video');
  expect(screen.getByTestId('session-href')).toHaveTextContent(
    'queueId=old-room-item'
  );
  fireEvent.click(screen.getByRole('button', { name: '测试个人观看' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-following')).toHaveTextContent('false')
  );
  expect(screen.getByTestId('session-href').textContent).not.toContain(
    'queueId='
  );
  expect(screen.getByTestId('session-video')).toBe(video);
});

it('sharing into a new room never publishes an item belonging to the previous room queue', () => {
  mockRoom = makeRoom();
  mockRoom.currentRoom.currentState.queueItemId = 'old-room-item';
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '分享到新房间' }));
  mockRoom = makeRoom();
  mockRoom.currentRoom.id = 'room-2';
  mockRoom.currentRoom.currentState = null as unknown as PlayState;
  view.rerender(<Harness />);
  expect(screen.getByTestId('room-selection')).toHaveTextContent('id=film-a');
  expect(screen.getByTestId('room-selection').textContent).not.toContain(
    'queueId='
  );
  expect(screen.getByTestId('session-href').textContent).not.toContain(
    'queueId='
  );
});

it('restores personal viewing for the remembered account and room after a reload', async () => {
  localStorage.setItem(
    'watch_room_info',
    JSON.stringify({
      roomId: 'room-1',
      roomName: '测试房间',
      userName: 'viewer',
      timestamp: Date.now(),
      following: false,
      personalHref: FILM_B,
    })
  );
  mockRoom = makeRoom();
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b')
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  expect(mockRoom.roomCommand).toHaveBeenCalledWith('room:following', {
    following: false,
  });
});

it('does not restore the personal film or mode saved by another account', async () => {
  localStorage.setItem(
    'watch_room_info',
    JSON.stringify({
      roomId: 'room-1',
      userName: 'another-account',
      timestamp: Date.now(),
      following: false,
      personalHref: FILM_B,
    })
  );
  mockRoom = makeRoom();
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-a')
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
});

it('does not apply a different room personal preference to a newly joined room', async () => {
  localStorage.setItem(
    'watch_room_info',
    JSON.stringify({
      roomId: 'old-room',
      userName: 'viewer',
      timestamp: Date.now(),
      following: false,
      personalHref: FILM_B,
    })
  );
  mockRoom = makeRoom();
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-a')
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
});

it('an old close acknowledgement cannot stop a newer personal selection', async () => {
  mockPathname = '/search';
  mockRoom = makeRoom();
  const closing = deferred();
  const selecting = deferred();
  mockRoom.roomCommand
    .mockReturnValueOnce(closing.promise)
    .mockReturnValueOnce(selecting.promise);
  render(<Harness />);
  await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));
  fireEvent.click(screen.getByRole('button', { name: '明确自己看 B' }));
  await act(async () => selecting.resolve());
  expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b');
  await act(async () => closing.resolve());
  expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b');
  expect(screen.getByTestId('session-video')).toBeInTheDocument();
});

it('late metadata cannot rewrite the playback URL during a new personal choice', async () => {
  mockRoom = makeRoom();
  const confirmation = deferred();
  mockRoom.roomCommand.mockReturnValueOnce(confirmation.promise);
  render(<Harness />);
  const original = screen.getByTestId('session-href').textContent;
  fireEvent.click(screen.getByRole('button', { name: '明确自己看 B' }));
  fireEvent.click(screen.getByRole('button', { name: '旧播放器补资料' }));
  expect(screen.getByTestId('session-href').textContent).toBe(original);
  await act(async () => confirmation.resolve());
  expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-b');
});

it('an explicit together choice marks the selected film for the current room', async () => {
  mockRoom = makeRoom();
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '明确一起看 B' }));
  await waitFor(() =>
    expect(screen.getByTestId('room-selection')).toHaveTextContent('id=film-b')
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByTestId('session-following')).toHaveTextContent('true');
});

it('sharing to a newly created room survives the room transition and never targets the old room', async () => {
  mockRoom = makeRoom();
  const view = render(<Harness />);
  await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '分享到新房间' }));
  expect(screen.getByTestId('room-selection')).toBeEmptyDOMElement();
  mockRoom = makeRoom();
  mockRoom.currentRoom.id = 'room-2';
  mockRoom.currentRoom.currentState = null as unknown as PlayState;
  view.rerender(<Harness />);
  await waitFor(() =>
    expect(screen.getByTestId('room-selection')).toHaveTextContent('id=film-a')
  );
});

it('asks an ordinary member how to watch even when the room has not started a film', () => {
  mockRoom = makeRoom();
  mockRoom.canControl = false;
  mockRoom.currentRoom.currentState = null as unknown as PlayState;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByTestId('session-href')).toBeEmptyDOMElement();
});

it('ignores an old queue acknowledgement after a room switch and keeps a newer choice', async () => {
  mockRoom = makeRoom();
  const oldRoom = mockRoom;
  const queued = deferred();
  oldRoom.roomCommand.mockReturnValue(queued.promise);
  const view = render(<Harness />);
  await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  fireEvent.click(screen.getByRole('button', { name: /加入房间片单/ }));
  mockRoom = makeRoom();
  mockRoom.currentRoom.id = 'room-2';
  mockRoom.currentRoom.currentState = roomState('film-c');
  view.rerender(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '选择影片 B' }));
  await act(async () => queued.resolve());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByTestId('session-href')).toHaveTextContent('id=film-c');
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
  const back = screen.getByRole('link', { name: /返回房间/ });
  expect(back).toHaveAttribute('href', '/watch-room?room=room-1');
  expect(room.roomCommand).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '测试恢复一起看' }));
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

it('resuming an empty room acknowledges idle readiness so the device can start another activity', async () => {
  mockRoom = makeRoom();
  Object.assign(mockRoom.currentRoom, { currentState: null });
  render(<Harness />);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '测试个人观看' }))
  );
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
  mockRoom.roomCommand.mockClear();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '测试恢复一起看' }))
  );
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'room:sync-applied',
    expect.objectContaining({ roomId: 'room-1', appliedRevision: 7 })
  );
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'room:ready',
    expect.objectContaining({
      roomId: 'room-1',
      ready: true,
      appliedRevision: 7,
    })
  );
});

it.each([true, false])(
  'a nonmovie caller can distinguish personal transition success=%s before starting its media',
  async (success) => {
    mockRoom = makeRoom();
    Object.assign(mockRoom.currentRoom, { currentState: null });
    if (!success) mockRoom.roomCommand.mockRejectedValueOnce(new Error('断线'));
    mockPersonalResult = undefined;
    render(<Harness />);
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: '测试个人观看返回结果' })
      )
    );
    expect(mockPersonalResult).toBe(success);
    expect(screen.getByTestId('session-following')).toHaveTextContent(
      String(!success)
    );
  }
);

it('a superseded personal transition does not report success from a later personal intent', async () => {
  mockRoom = makeRoom();
  const old = deferred();
  mockRoom.roomCommand.mockImplementationOnce(() => old.promise);
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '测试个人观看返回结果' }));
  mockRoom.currentRoom.id = 'room-2';
  view.rerender(<Harness />);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '测试个人观看' }))
  );
  await act(async () => old.resolve());
  expect(mockPersonalResult).toBe(false);
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
  expect(screen.getByRole('link', { name: /返回房间/ })).toBeInTheDocument();
});

it('closing a leftover film window while the room is on another activity does not leave the room sync', async () => {
  mockPathname = '/live';
  const room = makeRoom();
  mockRoom = room;
  const view = render(<Harness />);
  await screen.findByTestId('global-playback-host');
  // 房间换成直播后，电影窗口还在：它只是旧窗口，不是当前共同活动
  mockRoom = {
    ...room,
    currentRoom: {
      ...room.currentRoom,
      revision: room.currentRoom.revision + 1,
      currentState: {
        type: 'live',
        channelId: 'qa',
        channelName: 'QA',
        channelUrl: 'https://media.test/live.m3u8',
        updatedAt: 1,
      } as never,
    },
  };
  view.rerender(<Harness />);
  await screen.findByTestId('global-playback-host');

  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));

  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
  expect(room.roomCommand).not.toHaveBeenCalledWith(
    'room:following',
    expect.anything()
  );
});

it('closing a leftover film window on another activity does not make the next reload start as personal viewing', async () => {
  localStorage.setItem(
    'watch_room_info',
    JSON.stringify({
      roomId: 'room-1',
      roomName: '测试房间',
      userName: 'viewer',
      timestamp: Date.now(),
    })
  );
  mockPathname = '/live';
  const room = makeRoom();
  mockRoom = room;
  const view = render(<Harness />);
  await screen.findByTestId('global-playback-host');
  mockRoom = {
    ...room,
    currentRoom: {
      ...room.currentRoom,
      currentState: {
        type: 'live',
        channelId: 'qa',
        channelName: 'QA',
        channelUrl: 'https://media.test/live.m3u8',
        updatedAt: 1,
      } as never,
    },
  };
  view.rerender(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '关闭播放' }));
  await waitFor(() =>
    expect(screen.queryByTestId('global-playback-host')).not.toBeInTheDocument()
  );
  // 只关了旧窗口，人仍在跟随房间；刷新后不能被存成“仅自己看”
  expect(
    JSON.parse(localStorage.getItem('watch_room_info') || '{}').following
  ).not.toBe(false);
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

it('after a reconnect the server forgets who watches alone, so the device says so again', async () => {
  mockPathname = '/watch-room';
  mockRoom = makeRoom();
  const room = mockRoom;
  const view = render(<Harness dock />);
  await screen.findByTestId('session-video');
  fireEvent.click(screen.getByRole('button', { name: '测试个人观看' }));
  await waitFor(() =>
    expect(screen.getByTestId('session-following')).toHaveTextContent('false')
  );
  expect(room.roomCommand).toHaveBeenCalledTimes(1);
  // 重连后重新加入：服务端给了全新会话，默认是“跟随”
  Object.assign(room, { rejoinCount: 1 });
  view.rerender(<Harness dock />);
  await waitFor(() => expect(room.roomCommand).toHaveBeenCalledTimes(2));
  expect(room.roomCommand).toHaveBeenLastCalledWith('room:following', {
    following: false,
  });
  expect(screen.getByTestId('session-following')).toHaveTextContent('false');
});

it('a device that follows the room has nothing to restate after a reconnect', async () => {
  mockPathname = '/watch-room';
  mockRoom = makeRoom();
  const room = mockRoom;
  const view = render(<Harness dock />);
  await screen.findByTestId('session-video');
  Object.assign(room, { rejoinCount: 1 });
  view.rerender(<Harness dock />);
  await act(async () => undefined);
  expect(room.roomCommand).not.toHaveBeenCalledWith('room:following', {
    following: false,
  });
});
