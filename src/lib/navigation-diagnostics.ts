const ROUTES = new Set([
  '',
  'douban',
  'watch-room',
  'search',
  'my',
  'play',
  'about',
  'login',
  'live',
  'music',
  'books',
  'manga',
]);

export function diagnosticRoute(path: string): string {
  const segment = path.split('?')[0].split('/')[1] || '';
  return ROUTES.has(segment) ? '/' + segment : '/other';
}

/** Keep only same-origin immutable build paths, never signed media or account URLs. */
export function diagnosticResource(
  value: string,
  origin: string
): string | null {
  try {
    const url = new URL(value, origin);
    return url.origin === origin && url.pathname.startsWith('/_next/static/')
      ? url.pathname
      : null;
  } catch {
    return null;
  }
}

export function summarizeIntervals(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const percentile = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
  // Lower-quartile cadence estimates the observed refresh budget, not advertised Hz.
  const budget = percentile(0.25);
  return {
    budget,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    worst: sorted[sorted.length - 1] || 0,
    overBudget: budget
      ? sorted.filter((value) => value > budget * 1.5).length
      : 0,
  };
}
