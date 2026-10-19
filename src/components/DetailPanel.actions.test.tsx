jest.mock('@/components/PosterAmbient', () => ({
  __esModule: true,
  default: () => null,
}));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import DetailPanel from './DetailPanel';
const originalFetch = global.fetch;
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((media: string) => ({
      media,
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
      onchange: null,
    })),
  });
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});
test.each([false, true])(
  'both detail presentations expose the original playback and room actions (drawer=%s)',
  async (useDrawer) => {
    const onPlay = jest.fn(),
      onTogether = jest.fn();
    render(
      <DetailPanel
        isOpen
        onClose={jest.fn()}
        title='验收影片'
        doubanId={123}
        useDrawer={useDrawer}
        onPlay={onPlay}
        onTogether={onTogether}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: '播放' }));
    fireEvent.click(screen.getByRole('button', { name: '一起看' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onTogether).toHaveBeenCalledTimes(1);
  }
);

test.each([false, true])(
  'zero episodes never render a stray zero (drawer=%s)',
  async (useDrawer) => {
    const { container } = render(
      <DetailPanel
        isOpen
        onClose={jest.fn()}
        title='零集数影片'
        useDrawer={useDrawer}
        cmsData={{ desc: '资料简介', episodes: [] }}
      />
    );
    await screen.findByText('资料简介');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('0 集')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('0 集');
  }
);

test.each([false, true])(
  'positive episode counts still appear (drawer=%s)',
  async (useDrawer) => {
    render(
      <DetailPanel
        isOpen
        onClose={jest.fn()}
        title='两集影片'
        useDrawer={useDrawer}
        cmsData={{ desc: '资料简介', episodes: ['first', 'second'] }}
      />
    );
    expect(await screen.findByText('2 集')).toBeInTheDocument();
  }
);
