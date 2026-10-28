import { cleanup, render } from '@testing-library/react';

import TVNativeVideo from './TVNativeVideo';

beforeEach(() => {
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {
    return undefined;
  });
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('TVNativeVideo exposes its video element', () => {
  it('hands the element to the page so it can take part in sound ownership', () => {
    const onElement = jest.fn();
    const view = render(
      <TVNativeVideo
        url='/clip.mp4'
        sourceType='native'
        onElement={onElement}
      />
    );
    const video = view.container.querySelector('video');
    expect(video).not.toBeNull();
    expect(onElement).toHaveBeenCalledWith(video);
  });

  it('lets go of the element when the player goes away', () => {
    const onElement = jest.fn();
    const view = render(
      <TVNativeVideo
        url='/clip.mp4'
        sourceType='native'
        onElement={onElement}
      />
    );
    view.unmount();
    expect(onElement).toHaveBeenLastCalledWith(null);
  });

  it('still plays without the callback', () => {
    const view = render(<TVNativeVideo url='/clip.mp4' sourceType='native' />);
    expect(view.container.querySelector('video')).not.toBeNull();
  });
});
