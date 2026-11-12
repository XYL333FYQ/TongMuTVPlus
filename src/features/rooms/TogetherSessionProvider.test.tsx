import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  TogetherSessionProvider,
  useTogetherSession,
} from './TogetherSessionProvider';
const mockRequest = jest.fn();
const mockStart = jest.fn();
const mockDispose = jest.fn();
const mockFollow = jest.fn();
let mockPlayerReady = false;
let mockPathname = '/watch-room';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('./synctv/api', () => ({
  TogetherApi: class {
    request = mockRequest;
  },
}));
jest.mock('./synctv/session', () => ({
  TogetherRoomSession: class {
    start = mockStart;
    dispose = mockDispose;
    follow = mockFollow;
    leave = jest.fn();
  },
}));
jest.mock('@/features/playback/PlaybackPortProvider', () => ({
  usePlaybackPort: () => ({
    read: () => ({
      ready: mockPlayerReady,
      mediaHref: mockPlayerReady ? '/play?source=cms&id=personal' : null,
    }),
  }),
}));
function Consumer() {
  const session = useTogetherSession();
  return (
    <>
      <span>{session?.identity?.displayName || 'anonymous'}</span>
      <button
        onClick={() => {
          void session?.open('room_one');
        }}
      >
        join
      </button>
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockPathname = '/watch-room';
  mockPlayerReady = false;
  mockRequest.mockImplementation(async (path) =>
    path === '/session'
      ? {
          identityId: 'identity_one',
          displayName: 'alice',
          upstreamUserId: 'user_one',
        }
      : {}
  );
});
test('room transport survives navigation and is disposed on root unmount', async () => {
  const view = render(
    <TogetherSessionProvider enabled>
      <Consumer />
    </TogetherSessionProvider>
  );
  await screen.findByText('alice');
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  mockPathname = '/search';
  view.rerender(
    <TogetherSessionProvider enabled>
      <Consumer />
    </TogetherSessionProvider>
  );
  await act(async () => undefined);
  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(mockDispose).not.toHaveBeenCalled();
  view.unmount();
  expect(mockDispose).toHaveBeenCalledTimes(1);
});
test('legacy mode never initializes a second room session', async () => {
  render(
    <TogetherSessionProvider enabled={false}>
      <Consumer />
    </TogetherSessionProvider>
  );
  await act(async () => undefined);
  expect(mockRequest).not.toHaveBeenCalled();
  expect(mockStart).not.toHaveBeenCalled();
});
test('joining while personally watching retains personal playback until explicit follow or start', async () => {
  mockPlayerReady = true;
  render(
    <TogetherSessionProvider enabled>
      <Consumer />
    </TogetherSessionProvider>
  );
  await screen.findByText('alice');
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mockStart).toHaveBeenCalled());
  expect(mockFollow).toHaveBeenCalledWith(false);
});
