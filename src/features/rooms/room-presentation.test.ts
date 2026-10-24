import {
  defaultRoomName,
  displayRoomName,
  maskedRoomId,
} from './room-presentation';

test('uses a readable name while keeping phone numbers and account identifiers out of default names', () => {
  expect(defaultRoomName('admin')).toBe('admin 的放映室');
  expect(defaultRoomName('14715857728')).toBe('我的放映室');
  expect(
    displayRoomName({
      id: 'abc123',
      name: '14715857728',
      ownerAccountId: '14715857728',
    })
  ).toBe('我的放映室');
  expect(
    displayRoomName({
      id: 'abc123',
      name: '周五电影夜',
      ownerAccountId: '14715857728',
    })
  ).toBe('周五电影夜');
  expect(maskedRoomId('14715857728')).toBe('1471…7728');
});
