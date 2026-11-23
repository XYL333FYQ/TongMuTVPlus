import { fireEvent, render, screen } from '@testing-library/react';

import { EmailSettingsPanel } from './EmailSettingsPanel';

test('notification settings open in the shared modal layer and close on Escape', () => {
  const onClose = jest.fn();
  render(
    <EmailSettingsPanel
      isOpen
      mounted
      onClose={onClose}
      userEmail=''
      onUserEmailChange={jest.fn()}
      emailNotifications={false}
      onEmailNotificationsChange={jest.fn()}
      pushNotifications={false}
      onPushNotificationsChange={jest.fn()}
      pushNotificationsSupported={false}
      pushNotificationsConfigured={false}
      pushNotificationsBusy={false}
      emailSettingsLoading={false}
      emailSettingsSaving={false}
      onSave={jest.fn()}
    />
  );
  const layer = screen.getByRole('dialog', { name: '通知设置' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
