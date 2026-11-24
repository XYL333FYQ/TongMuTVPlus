import {
  formatClock,
  formatDateTime,
  formatDuration,
  formatLocalDate,
  formatPaddedClock,
  formatTimeAgo,
  formatTimestamp,
} from './time';

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

test('formatTimeAgo', () => {
  const now = 10 * 86_400_000;
  expect(formatTimeAgo(now - 30_000, now)).toBe('刚刚');
  expect(formatTimeAgo(now - 5 * 60_000, now)).toBe('5分钟前');
  expect(formatTimeAgo(now - 3 * 3_600_000, now)).toBe('3小时前');
  expect(formatTimeAgo(now - 2 * 86_400_000, now)).toBe('2天前');
});

test('formatTimestamp 补齐两位', () => {
  expect(formatTimestamp(new Date(2026, 0, 5, 7, 8, 9))).toBe(
    '2026-01-05 07:08:09'
  );
});

test('解析不了的日期', () => {
  expect(formatLocalDate('不是日期')).toBe('不是日期');
  expect(formatDateTime('不是日期')).toBeNull();
});
