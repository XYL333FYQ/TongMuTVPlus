import { act, fireEvent, render, screen } from '@testing-library/react';

import RoomPlaybackButton from './RoomPlaybackButton';

test('a touch hold shows the hint without activating the playback action', () => {
  jest.useFakeTimers();
  const action = jest.fn();
  render(
    <RoomPlaybackButton
      hint='暂时脱离同步，房间连接和消息保留'
      onClick={action}
    >
      仅自己看
    </RoomPlaybackButton>
  );
  const button = screen.getByRole('button', { name: '仅自己看' });
  const event = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  fireEvent(button, event);
  act(() => jest.advanceTimersByTime(600));
  expect(button).toHaveAttribute('data-hint-open', 'true');
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();
  fireEvent.pointerDown(button);
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(action).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
