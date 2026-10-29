import { cleanup, render } from '@testing-library/react';

import MediaSessionBridge from './MediaSessionBridge';

afterEach(cleanup);

describe('MediaSessionBridge', () => {
  it('浏览器没有 mediaSession 时什么都不做', () => {
    expect(() => render(<MediaSessionBridge />)).not.toThrow();
  });

  it('注册播放/暂停动作，卸载时清掉，播放时写入标题', () => {
    const handlers: Record<string, unknown> = {};
    const session = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: jest.fn((name: string, fn: unknown) => {
        handlers[name] = fn;
      }),
    };
    Object.defineProperty(navigator, 'mediaSession', {
      value: session,
      configurable: true,
    });
    (window as unknown as { MediaMetadata: unknown }).MediaMetadata = class {
      constructor(public init: unknown) {}
    };
    document.title = '某电影 · TongMuTV Plus';

    const { unmount } = render(<MediaSessionBridge />);
    expect(handlers.play).toEqual(expect.any(Function));
    expect(handlers.pause).toEqual(expect.any(Function));

    const video = document.createElement('video');
    document.body.appendChild(video);
    video.dispatchEvent(new Event('play'));
    expect(session.playbackState).toBe('playing');
    expect((session.metadata as { init: { title: string } }).init.title).toBe(
      '某电影'
    );

    unmount();
    expect(handlers.play).toBeNull();
    delete (navigator as unknown as { mediaSession?: unknown }).mediaSession;
  });
});
