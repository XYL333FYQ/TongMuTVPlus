import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import ExternalLink, { useExternalAction } from './ExternalLink';

const desktop = window as Window & { TMDesktop?: { externalLinks?: boolean } };
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  document.documentElement.setAttribute('data-tm-platform', 'web');
  delete desktop.TMDesktop;
  delete window.TMShell;
});
afterEach(cleanup);

test('browser retains a real new-tab link and its existing description', () => {
  render(
    <ExternalLink href='https://example.test/project' label='项目仓库'>
      仓库
    </ExternalLink>
  );
  const link = screen.getByRole('link', { name: '项目仓库（在新标签页打开）' });
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
});

test('capable Windows describes the actual system handoff', () => {
  document.documentElement.setAttribute('data-tm-platform', 'desktop');
  desktop.TMDesktop = { externalLinks: true };
  render(
    <ExternalLink href='https://example.test/project' label='项目仓库'>
      仓库
    </ExternalLink>
  );
  expect(
    screen.getByRole('link', { name: '项目仓库（在外部打开）' })
  ).toBeTruthy();
});

test('old Windows copies an absolute link instead of a silently denied new window', async () => {
  document.documentElement.setAttribute('data-tm-platform', 'desktop');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <ExternalLink href='/play?id=one' label='播放链接'>
      播放
    </ExternalLink>
  );
  const link = screen.getByRole('link', { name: '播放链接（复制链接）' });
  expect(fireEvent.click(link)).toBe(false);
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      new URL('/play?id=one', location.href).href
    )
  );
  expect(
    await screen.findByText('链接已复制，可粘贴到相应应用打开。')
  ).toBeTruthy();
});

test('native capability is checked safely; failed copy leaves a selectable address', async () => {
  document.documentElement.setAttribute('data-tm-platform', 'app');
  window.TMShell = {};
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: jest.fn().mockReturnValue(false),
  });
  render(
    <ExternalLink href='https://example.test/project' label='项目仓库'>
      仓库
    </ExternalLink>
  );
  fireEvent.click(screen.getByRole('link', { name: '项目仓库（复制链接）' }));
  expect(
    await screen.findByRole('textbox', { name: '可复制的链接' })
  ).toHaveProperty('value', 'https://example.test/project');
  expect(screen.getByRole('dialog', { name: '复制链接' })).toBeTruthy();
});

test('installed web app without a native bridge keeps browser link handling', () => {
  document.documentElement.setAttribute('data-tm-platform', 'app');
  render(
    <ExternalLink href='https://example.test/project' label='项目仓库'>
      仓库
    </ExternalLink>
  );
  expect(
    screen.getByRole('link', { name: '项目仓库（在新标签页打开）' })
  ).toBeTruthy();
});

function ActionFixture() {
  const action = useExternalAction();
  return (
    <>
      <button onClick={() => action.open('/play?id=one')}>
        {action.description}
      </button>
      {action.feedback}
    </>
  );
}

test('imperative native action opens synchronously during the original click', () => {
  document.documentElement.setAttribute('data-tm-platform', 'app');
  window.TMShell = { supportsExternalLinks: () => true };
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  render(<ActionFixture />);
  fireEvent.click(screen.getByRole('button', { name: '在外部打开' }));
  expect(open).toHaveBeenCalledWith(
    '/play?id=one',
    '_blank',
    'noopener,noreferrer'
  );
  open.mockRestore();
});

test('imperative old-client action copies without calling a denied new window', async () => {
  document.documentElement.setAttribute('data-tm-platform', 'desktop');
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(<ActionFixture />);
  fireEvent.click(screen.getByRole('button', { name: '复制链接' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      new URL('/play?id=one', location.href).href
    )
  );
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});
