import { fireEvent, render, screen } from '@testing-library/react';

import MiniPlayerControls from './MiniPlayerControls';

const base = {
  title: '影片 A',
  expand: { label: '回到播放页', onClick: jest.fn() },
  close: { label: '关闭播放', onClick: jest.fn() },
  sound: {
    muted: false,
    muteLabel: '静音本机',
    unmuteLabel: '开启本机声音',
    onToggle: jest.fn(),
  },
};

it('mini window: every action is a real button with its own name', () => {
  const onToggle = jest.fn();
  render(
    <MiniPlayerControls
      {...base}
      extra={{ kind: 'fold', label: '收起画面，继续播放', onClick: jest.fn() }}
      play={{
        paused: true,
        playLabel: '播放',
        pauseLabel: '暂停',
        onToggle,
      }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '播放' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '回到播放页' }));
  expect(base.expand.onClick).toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '回到播放页：影片 A' })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '关闭播放' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '收起画面，继续播放' })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '静音本机' })).toBeInTheDocument();
});

it('room mini window: links back to the room, shows unread chat and hides play without permission', () => {
  render(
    <MiniPlayerControls
      {...base}
      expand={{ label: '回到房间', href: '/watch-room' }}
      extra={{
        kind: 'chat',
        label: '房间聊天，3 条未读',
        onClick: jest.fn(),
        badge: 3,
      }}
    />
  );
  expect(screen.getByRole('link', { name: '回到房间' })).toHaveAttribute(
    'href',
    '/watch-room'
  );
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '播放' })).toBeNull();
});

it('folded bar: the title restores the window, the expand button opens the page', () => {
  const restore = jest.fn();
  render(
    <MiniPlayerControls
      {...base}
      variant='bar'
      titleAction={{ label: '展开小窗', onClick: restore }}
      hint='此页静音'
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '展开小窗：影片 A' }));
  expect(restore).toHaveBeenCalled();
  expect(screen.getByText('此页静音')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '回到播放页' })
  ).toBeInTheDocument();
});
