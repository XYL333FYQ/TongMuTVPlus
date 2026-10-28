jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => null,
}));
jest.mock('@/hooks/useVoiceChat', () => ({
  useVoiceChat: (options: unknown) => {
    mockVoiceCalls.push(options as { enabled: boolean });
    return { isConnecting: false, error: null };
  },
}));

import { fireEvent, render, screen } from '@testing-library/react';

import ChatFloatingWindow from './ChatFloatingWindow';

const mockVoiceCalls: Array<{ enabled: boolean }> = [];
let mockRoom: any;

beforeEach(() => {
  mockVoiceCalls.length = 0;
  mockRoom = {
    currentRoom: { id: 'room-a', name: '语音验收', memberCount: 1 },
    members: [],
    socket: null,
    isConnected: true,
    canControl: false,
    notices: [],
    chatMessages: [],
    markChatRead: jest.fn(() => Promise.resolve()),
    roomCommand: jest.fn(() => Promise.resolve()),
    loadChatHistory: jest.fn(() => Promise.resolve([])),
  };
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  window.IntersectionObserver = class {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  delete window.RUNTIME_CONFIG;
});

const openChat = () => {
  fireEvent.click(screen.getByRole('button', { name: /房间聊天/ }));
};

test('voice is off unless the site turns it on: no controls and the voice engine stays idle', () => {
  window.RUNTIME_CONFIG = {};
  render(<ChatFloatingWindow />);
  openChat();
  expect(screen.queryByRole('button', { name: '开启麦克风' })).toBeNull();
  expect(mockVoiceCalls.length).toBeGreaterThan(0);
  expect(mockVoiceCalls.every((call) => call.enabled === false)).toBe(true);
});

test('voice shows its controls and runs only when the site config opens it', () => {
  window.RUNTIME_CONFIG = { ENABLE_ROOM_VOICE: true };
  render(<ChatFloatingWindow />);
  openChat();
  expect(
    screen.getByRole('button', { name: '开启麦克风' })
  ).toBeInTheDocument();
  expect(mockVoiceCalls[mockVoiceCalls.length - 1].enabled).toBe(true);
});
