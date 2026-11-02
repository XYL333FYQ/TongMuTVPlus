import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

import { refreshPage } from '@/lib/page-refresh';

import AcgSearch from '@/components/AcgSearch';
import PansouSearch from '@/components/PansouSearch';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/search',
}));

const originalFetch = global.fetch;
let fetchMock: jest.Mock;
const items = (title: string) => ({
  total: 1,
  merged_by_type: {
    others: [
      {
        url: 'https://example.com/file',
        note: title,
        password: '',
        datetime: '',
        source: '',
      },
    ],
  },
  items: [
    {
      title,
      link: 'https://example.com/file',
      guid: title,
      pubDate: '',
      torrentUrl: '',
      description: '',
      images: [],
    },
  ],
});
const response = (title: string) => ({
  ok: true,
  json: async () => items(title),
});

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  document.documentElement.dataset.tmPlatform = 'app';
  fetchMock = jest.fn().mockResolvedValue(response('旧结果'));
  global.fetch = fetchMock;
  window.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  delete document.documentElement.dataset.tmPlatform;
});

describe.each(['pansou', 'acg'] as const)('%s client refresh', (kind) => {
  const content = (keyword = '电影', triggerSearch = false) =>
    kind === 'pansou' ? (
      <PansouSearch keyword={keyword} triggerSearch={triggerSearch} />
    ) : (
      <AcgSearch keyword={keyword} triggerSearch={triggerSearch} />
    );

  test('pull refresh keeps the submitted query while the input contains an unsubmitted draft', async () => {
    const view = render(content());
    await screen.findByText('旧结果');
    view.rerender(content('未提交草稿'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await refreshPage('/search')).toBe('success');
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).keyword).toBe('电影');
  });

  test('submitting a new query cancels old refresh without losing the new result', async () => {
    const view = render(content());
    await screen.findByText('旧结果');
    let complete!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    let pending!: ReturnType<typeof refreshPage>;
    act(() => {
      pending = refreshPage('/search');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    fetchMock.mockResolvedValueOnce(response('新查询结果'));
    view.rerender(content('新查询', true));
    await screen.findByText('新查询结果');
    expect(signal.aborted).toBe(true);
    expect(await pending).toBe('cancelled');
    await act(async () => {
      complete(response('过期结果'));
    });
    expect(screen.queryByText('过期结果')).not.toBeInTheDocument();
    expect(screen.getByText('新查询结果')).toBeInTheDocument();
  });

  test('refreshes current query without hiding old results; failure reports once and keeps them', async () => {
    render(content());
    await screen.findByText('旧结果');
    let complete!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    let pending!: ReturnType<typeof refreshPage>;
    act(() => {
      pending = refreshPage('/search');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('旧结果')).toBeInTheDocument();
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await act(async () => {
      complete(response('新结果'));
      expect(await pending).toBe('success');
    });
    expect(screen.getByText('新结果')).toBeInTheDocument();
    expect(screen.queryByText('旧结果')).not.toBeInTheDocument();
    fetchMock.mockRejectedValueOnce(new Error('受控失败'));
    await act(async () => {
      expect(await refreshPage('/search')).toBe('failed');
    });
    expect(screen.getByText('新结果')).toBeInTheDocument();
    expect(screen.queryByText('受控失败')).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).keyword).toBe('电影');
  });

  test('unmount aborts refresh and a late body cannot replace the next tab', async () => {
    const first = render(content());
    await screen.findByText('旧结果');
    let complete!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    let pending!: ReturnType<typeof refreshPage>;
    act(() => {
      pending = refreshPage('/search');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    first.unmount();
    expect(signal.aborted).toBe(true);
    expect(await pending).toBe('cancelled');
    render(content());
    await screen.findByText('旧结果');
    await act(async () => {
      complete(response('过期结果'));
    });
    expect(screen.queryByText('过期结果')).not.toBeInTheDocument();
  });

  test.each(['web', 'desktop'])(
    '%s does not register App refresh',
    async (platform) => {
      document.documentElement.dataset.tmPlatform = platform;
      render(content());
      await screen.findByText('旧结果');
      expect(await refreshPage('/search')).toBe('unavailable');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
});
