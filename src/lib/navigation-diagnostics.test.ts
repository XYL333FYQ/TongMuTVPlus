import {
  diagnosticResource,
  diagnosticRoute,
  summarizeIntervals,
} from './navigation-diagnostics';

test('high refresh frame stalls are counted below the old 50ms threshold', () => {
  const result = summarizeIntervals([8, 8, 8, 8, 8, 8, 25, 32]);
  expect(result.budget).toBe(8);
  expect(result.overBudget).toBe(2);
  expect(result.p95).toBe(32);
});

test('empty and invalid timings cannot produce nonfinite report values', () => {
  expect(summarizeIntervals([0, -1, NaN, Infinity])).toEqual({
    budget: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    worst: 0,
    overBudget: 0,
  });
});

test('reports omit room identifiers, queries, signed media and external URLs', () => {
  expect(diagnosticRoute('/watch-room/private-room?token=secret')).toBe(
    '/watch-room'
  );
  expect(diagnosticRoute('/unknown/private')).toBe('/other');
  expect(
    diagnosticResource(
      'https://tv.test/_next/static/chunks/app-a123.js?token=secret',
      'https://tv.test'
    )
  ).toBe('/_next/static/chunks/app-a123.js');
  expect(
    diagnosticResource(
      'https://cdn.test/movie.mp4?signature=secret',
      'https://tv.test'
    )
  ).toBeNull();
  expect(
    diagnosticResource(
      'https://tv.test/api/media?token=secret',
      'https://tv.test'
    )
  ).toBeNull();
});
