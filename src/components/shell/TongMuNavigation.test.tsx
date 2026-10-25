jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: jest.fn(),
}));

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { MoreMenu } from './TongMuNavigation';

const runtimeAllOpen = {
  SITE_LIVE_ENABLED: true,
  LIVE_ENABLED: true,
  SITE_WEB_LIVE_ENABLED: true,
  WEB_LIVE_ENABLED: true,
  SITE_MUSIC_ENABLED: true,
  MUSIC_ENABLED: true,
  SITE_BOOKS_ENABLED: true,
  BOOKS_ENABLED: true,
  SITE_MANGA_ENABLED: true,
  SUWAYOMI_ENABLED: true,
  SITE_PRIVATE_LIBRARY_ENABLED: true,
  PRIVATE_LIBRARY_ENABLED: true,
  SITE_ADVANCED_RECOMMENDATION_ENABLED: true,
  ADVANCED_RECOMMENDATION_ENABLED: true,
  SITE_MOVIE_REQUEST_ENABLED: true,
  ENABLE_MOVIE_REQUEST: true,
  SITE_TV_MODE_ENABLED: true,
  ENABLE_TV_MODE: true,
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  delete window.RUNTIME_CONFIG;
});

const openExplore = () => {
  render(<MoreMenu label='更多功能' />);
  fireEvent.click(screen.getByRole('button', { name: '更多功能' }));
};

test('shows every grouped entry regardless of availability, without the removed duplicates', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
    role: 'user',
  });
  window.RUNTIME_CONFIG = { ...runtimeAllOpen } as never;
  openExplore();

  for (const label of [
    '电视直播',
    '网络直播',
    '音乐',
    '电子书',
    '漫画',
    '私人影库',
    '源站寻片',
    '高级推荐',
    '打开直链',
    '求片',
    '电视大屏',
  ]) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  for (const label of [
    '电影',
    '剧集',
    '动漫',
    '综艺',
    '短剧',
    '自定义分类',
    '离线下载',
  ]) {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  }
  for (const group of ['扩展内容', '影视辅助', '工具与服务', '使用模式']) {
    expect(screen.getByText(group)).toBeInTheDocument();
  }
});

test('a member without permission is told they lack access and stays in the menu', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
    role: 'user',
  });
  window.RUNTIME_CONFIG = {
    ...runtimeAllOpen,
    MUSIC_ENABLED: false,
  } as never;
  openExplore();

  expect(screen.getAllByText('未授权').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /音乐/ }));

  const notice = screen.getByRole('alertdialog');
  expect(notice).toHaveTextContent('当前账号没有使用权限');
  // 提示关闭后回到菜单，没有导航跳转
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.getByText('扩展内容')).toBeInTheDocument();
});

test('a member is told the feature is not opened when the site owner disabled it', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
    role: 'user',
  });
  window.RUNTIME_CONFIG = {
    ...runtimeAllOpen,
    SITE_MUSIC_ENABLED: false,
    MUSIC_ENABLED: false,
  } as never;
  openExplore();

  expect(screen.getAllByText('未开放').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /音乐/ }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    '站长暂未开放此功能'
  );
});

test('the site owner is sent to the admin panel instead of asking themselves', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'boss',
    role: 'owner',
  });
  window.RUNTIME_CONFIG = {
    ...runtimeAllOpen,
    SITE_MUSIC_ENABLED: false,
    MUSIC_ENABLED: false,
  } as never;
  openExplore();
  fireEvent.click(screen.getByRole('button', { name: /音乐/ }));

  const notice = screen.getByRole('alertdialog');
  expect(notice).toHaveTextContent('功能还没配置');
  expect(screen.getByRole('link', { name: '去管理面板' })).toHaveAttribute(
    'href',
    '/admin'
  );
  expect(
    screen.queryByRole('link', { name: '向站长申请' })
  ).not.toBeInTheDocument();
});

test('a guest is guided to log in for available features', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue(null);
  window.RUNTIME_CONFIG = { ...runtimeAllOpen } as never;
  openExplore();

  expect(screen.getAllByText('登录后可用').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /电视直播/ }));
  const notice = screen.getByRole('alertdialog');
  expect(notice).toHaveTextContent('登录后即可使用此功能');
  const login = screen.getByRole('link', { name: '去登录' });
  expect(login).toHaveAttribute(
    'href',
    expect.stringContaining('/login?redirect=')
  );
});

test('an available entry for a permitted member navigates with its original href', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
    role: 'user',
  });
  window.RUNTIME_CONFIG = { ...runtimeAllOpen } as never;
  openExplore();

  const music = screen.getByText('音乐').closest('a');
  expect(music).toHaveAttribute('href', '/music');
  expect(screen.queryAllByText('未开放')).toHaveLength(0);
});

test('source search respects the site switch without hiding its entry', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
  });
  window.RUNTIME_CONFIG = {
    ...runtimeAllOpen,
    ENABLE_SOURCE_SEARCH: false,
  } as never;
  openExplore();
  fireEvent.click(screen.getByRole('button', { name: /源站寻片/ }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    '站长暂未开放此功能'
  );
});

test('dismissing a notice closes the native dialog before removing it', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'member',
  });
  window.RUNTIME_CONFIG = {
    ...runtimeAllOpen,
    SITE_MUSIC_ENABLED: false,
  } as never;
  openExplore();
  fireEvent.click(screen.getByRole('button', { name: /音乐/ }));
  const dialog = screen.getByRole('alertdialog') as HTMLDialogElement;
  const close = jest.spyOn(dialog, 'close');
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(close).toHaveBeenCalled();
  close.mockRestore();
});
