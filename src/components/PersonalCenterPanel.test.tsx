import { fireEvent, render, screen } from '@testing-library/react';

import { PersonalCenterPanel } from './PersonalCenterPanel';

test('the personal center opens in the shared modal layer and closes on Escape', () => {
  const onClose = jest.fn();
  render(
    <PersonalCenterPanel
      isOpen
      mounted
      onClose={onClose}
      username='audit-user'
      roleText='成员'
      showRoleBadge={false}
      avatarText='A'
      roleBadgeClassName=''
      showDeviceManagement
      showChangePassword
      onOpenEmailSettings={jest.fn()}
      onOpenDeviceManagement={jest.fn()}
      onOpenChangePassword={jest.fn()}
    />
  );
  const layer = screen.getByRole('dialog', { name: '个人中心' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
