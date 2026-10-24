import { getDeviceDisplayName } from './device-display';

it.each(['MoonTVPlus APP', 'moontvplus app', 'MoonTVPlus', 'MoonTV Plus'])(
  'uses a neutral display name for a legacy client: %s',
  (name) => {
    expect(getDeviceDisplayName(name)).toBe('兼容客户端');
  }
);

it.each(['Chrome', 'OrionTV', '未知设备', ''])(
  'preserves other device names: %s',
  (name) => {
    expect(getDeviceDisplayName(name)).toBe(name);
  }
);
