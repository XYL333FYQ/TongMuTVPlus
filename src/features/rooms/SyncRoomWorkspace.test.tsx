import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncRoomWorkspace from './SyncRoomWorkspace';
const mockRequest = jest.fn();
const mockOpen = jest.fn();
const mockSend = jest.fn();
const mockReplace = jest.fn();
const mockApi = { request: mockRequest };
let mockRoomId: string | null = null;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/features/playback/PlaybackSlot', () => ({
  __esModule: true,
  default: () => <div>player slot</div>,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => ({ href: null }),
}));
jest.mock('./TogetherSessionProvider', () => ({
  useTogetherSession: () => ({
    enabled: true,
    identity: { identityId: 'actor', displayName: 'alice' },
    roomId: mockRoomId,
    joining: false,
    snapshot: { following: true, canControlPlayback: false, resources: {} },
    api: mockApi,
    open: mockOpen,
    send: mockSend,
    observe: () => jest.fn(),
  }),
}));
jest.mock('./RoomFilmPicker', () => ({
  __esModule: true,
  default: ({ onAdd }: { onAdd: (href: string) => void }) => (
    <button onClick={() => onAdd('/play?source=cms&id=film&episode=2')}>
      pick fixture
    </button>
  ),
}));
jest.mock('./synctv/identifiers', () => ({
  operationId: () => 'ba2b6bde-6975-4f33-b687-5427fda60e5c',
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockRoomId = null;
  mockRequest.mockImplementation(async (path, init) =>
    init?.method === 'POST' && path === '/rooms'
      ? { id: 'room_new' }
      : path.endsWith('/media')
      ? { upstreamMediaId: 'med_one' }
      : { rooms: [], members: [], room: { id: 'room_one', name: 'Room' } }
  );
});
test('creation uses the site bridge and opens the new room in the existing route', async () => {
  render(<SyncRoomWorkspace />);
  fireEvent.change(screen.getByLabelText('房间名称'), {
    target: { value: 'Shared evening' },
  });
  fireEvent.submit(screen.getByRole('form', { name: '创建房间' }));
  await waitFor(() => expect(mockOpen).toHaveBeenCalledWith('room_new', false));
  expect(mockRequest).toHaveBeenCalledWith(
    '/rooms',
    expect.objectContaining({
      method: 'POST',
      body: { name: 'Shared evening', isPublic: false },
    })
  );
  expect(mockReplace).toHaveBeenCalledWith('/watch-room?room=room_new');
  expect(mockSend).not.toHaveBeenCalled();
});
test('adding a selected episode registers media and never starts shared playback', async () => {
  mockRoomId = 'room_one';
  render(<SyncRoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'pick fixture' }));
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      '/rooms/room_one/media',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          source: 'cms',
          filmId: 'film',
          episodeIndex: 1,
          kind: 'movie',
        }),
      })
    )
  );
  expect(mockSend).not.toHaveBeenCalled();
});
test('form errors are exposed after an invalid submission and clear when the value is corrected', async () => {
  render(<SyncRoomWorkspace />); const input = screen.getByLabelText('房间名称');
  expect(input).toHaveAttribute('aria-invalid', 'false'); fireEvent.invalid(input);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(input, { target: { value: 'Corrected room' } });
  expect(input).toHaveAttribute('aria-invalid', 'false');
});
