import { act, cleanup, render } from '@testing-library/react';

import { useStandalonePlayback } from './useStandalonePlayback';

const mockClaimSound = jest.fn();
jest.mock('@/features/watch/session/useAudioFocus', () => ({
  useAudioFocus: () => ({ ownsSound: true, claimSound: mockClaimSound }),
}));

let api: ReturnType<typeof useStandalonePlayback>;
function Probe() {
  api = useStandalonePlayback();
  return null;
}

beforeEach(() => {
  mockClaimSound.mockClear();
});
afterEach(cleanup);

describe('a standalone player (TV) next to a room', () => {
  it('may load at once: it never leaves or pauses the room, it only takes the sound', () => {
    render(<Probe />);
    expect(api.ready).toBe(true);
    expect(api.error).toBeNull();
  });

  it('takes the sound only when the video really plays', () => {
    render(<Probe />);
    const video = document.createElement('video');
    act(() => api.bindVideo(video));
    expect(mockClaimSound).not.toHaveBeenCalled();
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });

  it('a video that already started before it was handed over still takes the sound', () => {
    render(<Probe />);
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { value: false });
    act(() => api.bindVideo(video));
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });

  it('a video that is still paused does not take the sound by being handed over', () => {
    render(<Probe />);
    const video = document.createElement('video');
    act(() => api.bindVideo(video));
    expect(mockClaimSound).not.toHaveBeenCalled();
  });

  it('stops listening to a video that was replaced', () => {
    render(<Probe />);
    const first = document.createElement('video');
    const second = document.createElement('video');
    act(() => api.bindVideo(first));
    act(() => api.bindVideo(second));
    act(() => {
      first.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).not.toHaveBeenCalled();
    act(() => {
      second.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });
});
