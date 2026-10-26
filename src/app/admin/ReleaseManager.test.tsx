import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ReleaseManager from './ReleaseManager';

const originalFetch = global.fetch;
const data = {
  version: '0.1.1',
  entries: [
    {
      version: '0.1.1',
      date: '2026-10-25',
      added: ['原有记录'],
      changed: [],
      fixed: [],
    },
  ],
};
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ ETag: '"original"' }),
    json: async () => data,
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('adds and saves a new version while retaining history', async () => {
  render(<ReleaseManager />);
  await screen.findByDisplayValue('原有记录');
  fireEvent.click(screen.getByRole('button', { name: '新增版本' }));
  fireEvent.change(screen.getAllByLabelText('版本号')[0], {
    target: { value: '0.2.0' },
  });
  fireEvent.change(screen.getAllByLabelText('发布日期')[0], {
    target: { value: '2026-10-26' },
  });
  fireEvent.change(screen.getAllByLabelText('问题修复')[0], {
    target: { value: ' 修复甲\n\n修复乙 ' },
  });
  (global.fetch as jest.Mock).mockImplementation(async (_url, init) => ({
    ok: true,
    headers: new Headers({ ETag: '"updated"' }),
    json: async () => (init?.method === 'POST' ? JSON.parse(init.body) : data),
  }));
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  await screen.findByText('已发布，版本信息已更新');
  const call = (global.fetch as jest.Mock).mock.calls.find(
    ([, init]) => init?.method === 'POST'
  );
  expect(call?.[1].headers['If-Match']).toBe('"original"');
  expect(JSON.parse(call?.[1].body)).toEqual({
    version: '0.2.0',
    entries: [
      {
        version: '0.2.0',
        date: '2026-10-26',
        added: [],
        changed: [],
        fixed: ['修复甲', '修复乙'],
      },
      ...data.entries,
    ],
  });
});

test('invalid version never sends a save and failure preserves the draft', async () => {
  render(<ReleaseManager />);
  const version = await screen.findByDisplayValue('0.1.1');
  fireEvent.change(version, { target: { value: 'bad' } });
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('版本号');
  expect(
    (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => init?.method === 'POST'
    )
  ).toHaveLength(0);
  fireEvent.change(version, { target: { value: '0.1.2' } });
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: async () => ({ error: '保存失败，请重试' }),
  });
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败')
  );
  expect(screen.getByDisplayValue('0.1.2')).toBeInTheDocument();
  expect(screen.queryByText('已发布，版本信息已更新')).toBeNull();
});

test('load errors are visible and retry can recover', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: '读取失败' }),
  });
  render(<ReleaseManager />);
  await screen.findByText('读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByDisplayValue('原有记录')).toBeInTheDocument();
});

test('conflict preserves draft and exposes an explicit reload action', async () => {
  render(<ReleaseManager />);
  await screen.findByDisplayValue('原有记录');
  fireEvent.change(screen.getByLabelText('新增功能'), {
    target: { value: '未保存的草稿' },
  });
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ error: '其他窗口已更新，草稿保留' }),
  });
  fireEvent.click(screen.getByRole('button', { name: '保存并发布' }));
  await screen.findByText('其他窗口已更新，草稿保留');
  expect(screen.getByDisplayValue('未保存的草稿')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: '重新加载（放弃当前草稿）' })
  );
  await screen.findByDisplayValue('原有记录');
  expect(screen.queryByDisplayValue('未保存的草稿')).toBeNull();
});
