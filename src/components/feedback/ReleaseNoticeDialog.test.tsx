import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import ReleaseNoticeDialog from '@/components/feedback/ReleaseNoticeDialog';

jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => false }));

const SEEN_KEY = 'tongmu:release-notice-seen';
const release = (version: string, fixed = ['修好了一个问题']) => ({
  version,
  entries: [
    {
      version,
      date: '2026-10-27',
      added: ['新增了一个功能'],
      changed: [],
      fixed,
    },
    {
      version: '0.0.9',
      date: '2026-10-01',
      added: ['很久以前的功能'],
      changed: [],
      fixed: [],
    },
  ],
});

const originalFetch = global.fetch;
function serve(body: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}
async function mount(blocked = false) {
  const view = render(<ReleaseNoticeDialog blocked={blocked} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

test("a newly published version pops up once with only that version's notes, even for a browser that has never seen any", async () => {
  serve({ ReleaseInfo: release('0.1.2') });
  await mount();
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('0.1.2');
  expect(dialog).toHaveTextContent('新增了一个功能');
  expect(dialog).toHaveTextContent('修好了一个问题');
  expect(dialog).not.toHaveTextContent('很久以前的功能');
});

test('acknowledging remembers the version, so the same release never pops up again', async () => {
  serve({ ReleaseInfo: release('0.1.2') });
  const first = await mount();
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(localStorage.getItem(SEEN_KEY)).toBe('0.1.2');
  first.unmount();
  await mount();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('editing the wording of a release that was already seen does not bring it back', async () => {
  localStorage.setItem(SEEN_KEY, '0.1.2');
  serve({ ReleaseInfo: release('0.1.2', ['换了一种说法']) });
  await mount();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('publishing the next version pops up again for someone who saw the previous one', async () => {
  localStorage.setItem(SEEN_KEY, '0.1.2');
  serve({ ReleaseInfo: release('0.1.3') });
  await mount();
  expect(screen.getByRole('dialog')).toHaveTextContent('0.1.3');
});

test('it waits while the site announcement is on screen and appears right after it is closed', async () => {
  serve({ ReleaseInfo: release('0.1.2') });
  const view = await mount(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<ReleaseNoticeDialog blocked={false} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('nothing is shown when the release information cannot be read', async () => {
  serve({}, false);
  await mount();
  expect(screen.queryByRole('dialog')).toBeNull();
  serve({ ReleaseInfo: { version: 'bad', entries: [] } });
  await mount();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a storage that cannot be written never traps the visitor behind the dialog', async () => {
  serve({ ReleaseInfo: release('0.1.2') });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  jest.restoreAllMocks();
});
