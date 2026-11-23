import { formatClock, formatDuration, formatPaddedClock } from './time';

test('formatClock', () => {
  expect(formatClock(309)).toBe('5:09');
  expect(formatClock(3909)).toBe('1:05:09');
  expect(formatClock(3700)).toBe('1:01:40');
  expect(formatClock(9.9)).toBe('0:09');
  expect(formatClock(NaN)).toBe('0:00');
  expect(formatClock(-5)).toBe('0:00');
  expect(formatClock(Infinity)).toBe('0:00');
});

test('formatPaddedClock', () => {
  expect(formatPaddedClock(309)).toBe('05:09');
  expect(formatPaddedClock(3909)).toBe('01:05:09');
  expect(formatPaddedClock(0)).toBe('00:00');
  expect(formatPaddedClock(NaN)).toBe('00:00');
});

test('formatDuration', () => {
  expect(formatDuration(30)).toBe('30秒');
  expect(formatDuration(90)).toBe('1分30秒');
  expect(formatDuration(120)).toBe('2分钟');
  expect(formatDuration(180.6)).toBe('3分钟');
  expect(formatDuration(NaN)).toBe('0秒');
});
