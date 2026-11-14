import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ChatPanel, { ChatPanelProps } from './ChatPanel';

import type { ChatMessage } from '@/types/watch-room';

function message(index: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${index}`,
    userId: 'u',
    userName: index % 2 ? 'alice' : 'me',
    accountId: index % 2 ? 'alice' : 'me',
    content: `消息 ${index}`,
    type: 'text',
    timestamp: 1_700_000_000_000 + index * 1000,
    seq: index + 1,
    ...extra,
  };
}

function setup(overrides: Partial<ChatPanelProps> = {}) {
  const props: ChatPanelProps = {
    messages: [message(0), message(1)],
    self: 'me',
    canChat: true,
    canModerate: false,
    connected: true,
    danmaku: true,
    onDanmakuChange: jest.fn(),
    onSend: jest.fn(async () => undefined),
    onDelete: jest.fn(),
    onLoadOlder: jest.fn(async () => 0),
    onRead: jest.fn(),
    ...overrides,
  };
  render(<ChatPanel {...props} />);
  return props;
}

beforeAll(() => {
  Element.prototype.scrollTo = jest.fn();
});

it('sends an emoji as an emoji message from the emoji panel', async () => {
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: '表情' }));
  fireEvent.click(screen.getByRole('button', { name: '发送 🍿' }));
  await waitFor(() => expect(props.onSend).toHaveBeenCalledWith('🍿', 'emoji'));
});

it('shows a lone emoji enlarged without a bubble', () => {
  setup({ messages: [message(0, { content: '🎉', type: 'emoji' })] });
  expect(screen.getByText('🎉').closest('.tm-t-bubble')).toHaveAttribute(
    'data-emoji',
    'true'
  );
});

it('does not offer older messages when the room has fewer than a page', () => {
  setup();
  expect(screen.queryByText('更早的消息')).not.toBeInTheDocument();
});

it('hides the older-messages button once the server has none left', async () => {
  const props = setup({
    messages: Array.from({ length: 50 }, (_, index) => message(index)),
  });
  fireEvent.click(screen.getByText('更早的消息'));
  await waitFor(() => expect(props.onLoadOlder).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText('更早的消息')).not.toBeInTheDocument()
  );
});

it('keeps the typed text when sending fails and shows why', async () => {
  setup({
    onSend: jest.fn(async () => {
      throw new Error('房间连接中断，请稍后重试');
    }),
  });
  const input = screen.getByRole('textbox', { name: '聊天内容' });
  fireEvent.change(input, { target: { value: '你好' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('房间连接中断');
  expect(input).toHaveValue('你好');
});
