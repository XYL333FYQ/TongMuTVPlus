import { act, render, screen } from '@testing-library/react';

import { useReleaseInfo } from './useReleaseInfo';

const originalFetch = global.fetch;
const release = {
  version: '0.2.0',
  entries: [
    {
      version: '0.2.0',
      date: '2026-10-25',
      added: ['新记录'],
      changed: [],
      fixed: [],
    },
  ],
};
function Display({ enabled = true }: { enabled?: boolean }) {
  const info = useReleaseInfo(enabled);
  return <span>{info.version}</span>;
}
afterEach(() => {
  global.fetch = originalFetch;
});

test('uses saved public version and refreshes after publishing', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ReleaseInfo: release }),
  });
  render(<Display />);
  await screen.findByText('0.2.0');
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      ReleaseInfo: {
        ...release,
        version: '0.3.0',
        entries: [{ ...release.entries[0], version: '0.3.0' }],
      },
    }),
  });
  act(() => window.dispatchEvent(new Event('tongmu:release-updated')));
  await screen.findByText('0.3.0');
});

test('offline and invalid responses retain bundled release; closing cancels old requests', async () => {
  let resolve: (value: unknown) => void = () => undefined;
  global.fetch = jest.fn().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { rerender } = render(<Display />);
  const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
  rerender(<Display enabled={false} />);
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolve({ ok: true, json: async () => ({ ReleaseInfo: release }) })
  );
  expect(screen.getByText('0.1.1')).toBeInTheDocument();
});
