import { fireEvent, render, screen } from '@testing-library/react';

import RoomMembers from './RoomMembers';

import type { Room } from '@/types/watch-room';

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: '测试房间',
    description: '',
    isPublic: false,
    hasPassword: false,
    roomType: 'sync',
    ownerAccountId: 'owner',
    ownerName: 'owner',
    memberCount: 2,
    currentState: null,
    createdAt: 0,
    myRole: 'owner',
    myPermissions: [
      'playback',
      'changeMedia',
      'addMedia',
      'managePlaylist',
      'chat',
      'manageMembers',
      'editRoom',
    ],
    roster: [
      {
        accountId: 'owner',
        role: 'owner',
        permissions: [],
        customPermissions: false,
        online: true,
        connections: 1,
        joinedAt: 0,
      },
      {
        accountId: 'friend',
        role: 'member',
        permissions: ['chat'],
        customPermissions: true,
        online: false,
        connections: 0,
        joinedAt: 1,
      },
    ],
    joinRequests: [{ accountId: 'newcomer', requestedAt: 2 }],
    ...overrides,
  } as Room;
}

it('lists every member with role and presence, and lets a manager approve a join request', () => {
  const mutate = jest.fn();
  render(
    <RoomMembers
      room={room()}
      selfAccountId='owner'
      busy={false}
      active
      mutate={mutate}
    />
  );
  expect(screen.getByText('1 人在线 · 共 2 人')).toBeInTheDocument();
  expect(
    screen.getByText('成员 · 不在线 · 单独设置了权限')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '同意' }));
  expect(mutate).toHaveBeenCalledWith('room:join-review', {
    accountId: 'newcomer',
    approve: true,
  });
  expect(
    screen.getByRole('button', { name: 'friend的成员操作' })
  ).toBeInTheDocument();
  // 不能对自己和房主操作
  expect(
    screen.queryByRole('button', { name: 'owner的成员操作' })
  ).not.toBeInTheDocument();
});

it('an ordinary member sees the roster but no management actions or join requests', () => {
  render(
    <RoomMembers
      room={room({
        myRole: 'member',
        myPermissions: ['chat'],
        joinRequests: [],
      })}
      selfAccountId='friend'
      busy={false}
      active
      mutate={jest.fn()}
    />
  );
  expect(screen.queryByText(/加入申请/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /的成员操作/ })
  ).not.toBeInTheDocument();
});
