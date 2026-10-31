import { act, cleanup, render } from '@testing-library/react';

import ShellBridge from './ShellBridge';

let setPlaying: jest.Mock;
beforeEach(() => {
  setPlaying = jest.fn();
  window.TMShell = { setPlaying };
});
afterEach(() => {
  cleanup();
  document
    .querySelectorAll('video,audio')
    .forEach((element) => element.remove());
  delete window.TMShell;
});
function media(playing: boolean) {
  const element = document.createElement('video');
  Object.defineProperty(element, 'paused', {
    configurable: true,
    value: !playing,
  });
  document.body.append(element);
  return element;
}
test('the shell gets an initial stopped snapshot even without a media event', () => {
  render(<ShellBridge />);
  expect(setPlaying).toHaveBeenCalledWith(false);
});
test('a media element already playing before bridge mount is reported immediately', () => {
  media(true);
  render(<ShellBridge />);
  expect(setPlaying).toHaveBeenCalledWith(true);
});
test('removing the playing element clears native playback without needing pause', async () => {
  const video = media(true);
  render(<ShellBridge />);
  setPlaying.mockClear();
  await act(async () => {
    video.remove();
    await Promise.resolve();
  });
  expect(setPlaying).toHaveBeenCalledWith(false);
});
test('pausing one element does not stop a second active element', () => {
  const first = media(true);
  media(true);
  render(<ShellBridge />);
  setPlaying.mockClear();
  Object.defineProperty(first, 'paused', { configurable: true, value: true });
  act(() => first.dispatchEvent(new Event('pause', { bubbles: true })));
  expect(setPlaying).not.toHaveBeenCalled();
});
