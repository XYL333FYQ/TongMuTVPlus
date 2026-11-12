import { createPlaybackPort } from './port';

function fixture() {
  const video = new EventTarget();
  const controller = {
    video,
    currentTime: 0,
    playing: false,
    playbackRate: 1,
    play: jest.fn(async () => {
      controller.playing = true;
      video.dispatchEvent(new Event('play'));
    }),
    pause: jest.fn(() => {
      controller.playing = false;
      video.dispatchEvent(new Event('pause'));
    }),
  };
  const load = jest.fn(async () => undefined);
  const port = createPlaybackPort({ controller: () => controller, load });
  port.attach(controller as never);
  return { port, controller, video, load };
}
test('personal controls publish local events and remote controls retain their origin', async () => {
  const { port, controller } = fixture();
  const events: unknown[] = [];
  port.subscribe((event) => events.push(event));
  await port.play('remote');
  port.pause('remote');
  await port.play('local');
  expect(events.map((event) => (event as { origin: string }).origin)).toEqual([
    'remote',
    'remote',
    'local',
  ]);
  expect(controller.play).toHaveBeenCalledTimes(2);
});
test('async seek events are attributed to matching remote values, not unrelated user actions', () => {
  const { port, controller, video } = fixture();
  const events: unknown[] = [];
  port.subscribe((event) => events.push(event));
  port.seek(20, 'remote');
  video.dispatchEvent(new Event('seeked'));
  controller.currentTime = 30;
  video.dispatchEvent(new Event('seeked'));
  expect(events.map((event) => (event as { origin: string }).origin)).toEqual([
    'remote',
    'local',
  ]);
  expect(port.read().currentTime).toBe(30);
});
test('slow buffered seeks and seek-to-end events keep remote attribution', () => {
  const { port, video } = fixture(); const events: { origin: string }[] = [];
  port.subscribe(event => events.push(event)); Object.assign(video, { duration: 100 });
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    port.seek(20, 'remote'); now.mockReturnValue(12000); video.dispatchEvent(new Event('seeked'));
    port.seek(100, 'remote'); video.dispatchEvent(new Event('ended'));
    expect(events.map(event => event.origin)).toEqual(['remote', 'remote']);
  } finally { now.mockRestore(); }
});
test('reattachment removes old subscriptions and preserves the same controller across presentation changes', () => {
  const { port, controller, video } = fixture();
  const listener = jest.fn();
  const unsubscribe = port.subscribe(listener);
  port.attach(controller as never);
  video.dispatchEvent(new Event('pause'));
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  video.dispatchEvent(new Event('pause'));
  expect(listener).toHaveBeenCalledTimes(1);
  port.attach(null);
  expect(port.read().ready).toBe(false);
  expect(() => port.seek(2)).toThrow('播放器尚未就绪');
});
test('load delegates media selection without rebuilding the media element; failed play does not suppress later local events', async () => {
  const { port, controller, video, load } = fixture();
  const listener = jest.fn();
  port.subscribe(listener);
  await port.load({ href: '/play?source=cms&id=film&episode=2' }, 'remote');
  expect(load).toHaveBeenCalledWith(
    { href: '/play?source=cms&id=film&episode=2' },
    'remote'
  );
  controller.play.mockRejectedValueOnce(new Error('autoplay blocked'));
  await expect(port.play('remote')).rejects.toThrow('autoplay blocked');
  controller.playing = true;
  video.dispatchEvent(new Event('play'));
  expect(listener.mock.calls[0][0].origin).toBe('local');
});
