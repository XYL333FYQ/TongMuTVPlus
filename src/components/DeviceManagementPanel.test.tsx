import { fireEvent, render, screen } from '@testing-library/react';
import { Monitor } from 'lucide-react';

import { DeviceManagementPanel } from './DeviceManagementPanel';

it('displays a compatible client name without changing the stored device record', () => {
  const device = {
    tokenId: 'test-device',
    deviceInfo: 'MoonTVPlus APP',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    isCurrent: true,
  };
  render(
    <DeviceManagementPanel
      isOpen
      mounted
      onClose={jest.fn()}
      devices={[device]}
      devicesLoading={false}
      revoking={null}
      onRevokeDevice={jest.fn()}
      onRevokeAllDevices={jest.fn()}
      getDeviceIcon={() => Monitor}
    />
  );
  expect(screen.getByText('兼容客户端')).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/MoonTVPlus/i);
  expect(device.deviceInfo).toBe('MoonTVPlus APP');
});

it('opens in the shared modal layer and closes on Escape', () => {
  const onClose = jest.fn();
  render(
    <DeviceManagementPanel
      isOpen
      mounted
      onClose={onClose}
      devices={[]}
      devicesLoading={false}
      revoking={null}
      onRevokeDevice={jest.fn()}
      onRevokeAllDevices={jest.fn()}
      getDeviceIcon={() => Monitor}
    />
  );
  const layer = screen.getByRole('dialog', { name: '设备管理' });
  expect(layer).toHaveClass('tm-modal-layer');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
