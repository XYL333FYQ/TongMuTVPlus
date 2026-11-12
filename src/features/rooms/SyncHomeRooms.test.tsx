import { act, render, screen } from '@testing-library/react';
import SyncHomeRooms from './SyncHomeRooms';
const mockRequest = jest.fn();
const mockApi = { request: mockRequest };
let mockIdentity = 'first';
jest.mock('./TogetherSessionProvider', () => ({
  useTogetherSession: () => ({
    enabled: true,
    identity: { identityId: mockIdentity },
    roomId: null,
    api: mockApi,
  }),
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => null,
}));
jest.mock('@/hooks/usePageRefresh', () => ({ usePageRefresh: jest.fn() }));
beforeEach(() => {
  mockIdentity = 'first';
  mockRequest.mockReset();
});
test('homepage room summary points to the existing room route and uses the SyncTV bridge', async () => {
  mockRequest.mockResolvedValue({
    rooms: [{ room: { id: 'room_one', name: 'Friends', memberCount: 2 } }],
  });
  render(<SyncHomeRooms />);
  expect(await screen.findByText('Friends')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Friends/ })).toHaveAttribute(
    'href',
    '/watch-room?room=room_one'
  );
  expect(mockRequest.mock.calls[0][0]).toContain('/rooms');
});
test('account changes hide the previous private room while the new summary is loading', async () => {
  mockRequest.mockResolvedValueOnce({
    rooms: [{ room: { id: 'room_one', name: 'Private first' } }],
  });
  const view = render(<SyncHomeRooms />);
  await screen.findByText('Private first');
  mockRequest.mockImplementation(() => new Promise(() => undefined));
  mockIdentity = 'second';
  view.rerender(<SyncHomeRooms />);
  await act(async () => undefined);
  expect(screen.queryByText('Private first')).not.toBeInTheDocument();
});
test('a failed summary fetch after account switch cannot relabel previous private data as the new account', async () => {
  mockRequest.mockResolvedValueOnce({
    rooms: [{ room: { id: 'room_one', name: 'Private first' } }],
  });
  const view = render(<SyncHomeRooms />);
  await screen.findByText('Private first');
  mockRequest.mockRejectedValue(new Error('offline'));
  mockIdentity = 'second';
  view.rerender(<SyncHomeRooms />);
  await act(async () => undefined);
  expect(screen.queryByText('Private first')).not.toBeInTheDocument();
});
