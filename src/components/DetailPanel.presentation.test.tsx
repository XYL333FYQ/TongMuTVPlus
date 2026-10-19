import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import DetailPanel from './DetailPanel';

jest.mock('@/components/PosterAmbient', () => ({
  __esModule: true,
  default: () => null,
}));
const originalFetch = global.fetch;
test('explicit poster ref restores focus when touch did not focus the poster', async () => {
  const poster = document.createElement('button'),
    other = document.createElement('button');
  document.body.append(poster, other);
  other.focus();
  const view = render(
    <DetailPanel
      isOpen
      title='触屏资料'
      onClose={jest.fn()}
      returnFocusRef={{ current: poster }}
      cmsData={{ desc: '简介' }}
    />
  );
  await screen.findByRole('dialog', { name: '触屏资料' });
  view.unmount();
  expect(poster).toHaveFocus();
  poster.remove();
  other.remove();
});
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
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

test('responsive detail is a named modal, focuses close and restores the poster', async () => {
  const trigger = document.createElement('button');
  trigger.textContent = '海报';
  document.body.appendChild(trigger);
  trigger.focus();
  const view = render(
    <DetailPanel
      isOpen
      onClose={jest.fn()}
      title='验收电影'
      cmsData={{ desc: '简介' }}
    />
  );
  const dialog = await screen.findByRole('dialog', { name: '验收电影' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '关闭详情' })).toHaveFocus()
  );
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test('playback drawer stays non-modal and keeps its supplied width', async () => {
  render(
    <DetailPanel
      isOpen
      useDrawer
      drawerWidth='w-[400px]'
      onClose={jest.fn()}
      title='侧栏资料'
      cmsData={{ desc: '简介' }}
    />
  );
  const dialog = await screen.findByRole('dialog', { name: '侧栏资料' });
  expect(dialog).toHaveAttribute('aria-modal', 'false');
  expect(dialog.querySelector('.tm-detail-panel')).toHaveClass('w-[400px]');
});

test('photo viewer Escape closes the top layer and leaves detail open', async () => {
  const close = jest.fn();
  render(
    <DetailPanel
      isOpen
      onClose={close}
      title='图片资料'
      poster='/poster.png'
      cmsData={{ desc: '简介' }}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: '查看海报大图' }));
  const imageDialog = await screen.findByRole('dialog', {
    name: '图片资料 海报',
  });
  fireEvent(
    imageDialog,
    new Event('cancel', { bubbles: false, cancelable: true })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: '图片资料 海报' })
    ).not.toBeInTheDocument()
  );
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: '图片资料' })).toBeInTheDocument();
});

test('movie has no season cards, absent favorite callback has no favorite button', async () => {
  render(
    <DetailPanel
      isOpen
      onClose={jest.fn()}
      title='电影'
      cmsData={{ desc: '简介', episodes: [] }}
    />
  );
  await screen.findByText('简介', { selector: 'p' });
  expect(screen.queryByText('季度')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '收藏' })
  ).not.toBeInTheDocument();
  expect(screen.queryByText('0 集')).not.toBeInTheDocument();
});

test('series preserves season and episode cards below synopsis without playback selection', async () => {
  global.fetch = jest.fn(async (input) => {
    const url = String(input);
    const data = url.includes('/search?')
      ? { results: [{ id: 902, media_type: 'tv' }] }
      : url.includes('/detail?')
      ? {
          name: '剧集资料',
          overview: '剧集简介',
          number_of_episodes: 2,
          number_of_seasons: 1,
        }
      : url.includes('/seasons?')
      ? {
          seasons: [
            { id: 1, name: '第一季', season_number: 1, episode_count: 2 },
          ],
        }
      : url.includes('/episodes?')
      ? {
          episodes: [
            {
              id: 1,
              name: '第一集资料',
              episode_number: 1,
              overview: '第一集简介',
              still_path: null,
            },
          ],
        }
      : { cast: [{ name: '演员' }], crew: [] };
    return { ok: true, json: async () => data } as Response;
  });
  const play = jest.fn();
  render(
    <DetailPanel
      isOpen
      title='剧集资料'
      type='tv'
      onClose={jest.fn()}
      onPlay={play}
    />
  );
  const card = await screen.findByText('第1集: 第一集资料');
  const intro = screen.getByText('剧集简介');
  expect(
    intro.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  fireEvent.click(card);
  expect(play).not.toHaveBeenCalled();
  expect(screen.getByText('季度')).toBeInTheDocument();
});

test('favorite callback is shown and invoked without adding detail data requests', async () => {
  const favorite = jest.fn();
  render(
    <DetailPanel
      isOpen
      onClose={jest.fn()}
      title='收藏来源'
      cmsData={{ desc: '简介' }}
      onFavorite={favorite}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: '收藏' }));
  expect(favorite).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('Tab cycles within the modal and cancel invokes its own close handler', async () => {
  const onClose = jest.fn();
  render(
    <DetailPanel
      isOpen
      onClose={onClose}
      title='焦点资料'
      cmsData={{ desc: '简介' }}
      onPlay={jest.fn()}
    />
  );
  const modal = await screen.findByRole('dialog', { name: '焦点资料' });
  const close = screen.getByRole('button', { name: '关闭详情' });
  await waitFor(() => expect(close).toHaveFocus());
  const targets = modal.querySelectorAll(
    'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
  );
  (targets[0] as HTMLElement).focus();
  fireEvent.keyDown(targets[0], { key: 'Tab', shiftKey: true });
  expect(targets[targets.length - 1]).toHaveFocus();
  fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
  expect(targets[0]).toHaveFocus();
  fireEvent(modal, new Event('cancel', { cancelable: true }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
