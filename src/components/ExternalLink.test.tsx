import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import ExternalLink from './ExternalLink';

const desktop = window as Window & { TMDesktop?: { externalLinks?: boolean } };
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
    await screen.findByText('链接已复制，可粘贴到浏览器打开。')
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
