import { portFor } from './port';

test('player events from a video that left the page are ignored', () => {
  const handlers = new Map<string, () => void>();
  const video = document.createElement('video');
  document.body.appendChild(video);
  const player = {
    video,
    on: (name: string, handler: () => void) => {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    },
  } as never;
  const listener = jest.fn();
  portFor(player).on('pause', listener);
  handlers.get('video:pause')?.();
  expect(listener).toHaveBeenCalledTimes(1);
  video.remove();
  handlers.get('video:pause')?.();
  expect(listener).toHaveBeenCalledTimes(1);
});
