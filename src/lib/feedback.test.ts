import {
  type FeedbackItem,
  checkNewFeedback,
  FEEDBACK_MAX_ITEMS,
  FEEDBACK_MAX_PENDING_PER_USER,
  parseFeedbackList,
  trimFeedback,
} from './feedback';

const now = 1_000_000;
const item = (over: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: Math.random().toString(36).slice(2),
  username: 'u',
  category: 'bug',
  message: 'x',
  status: 'pending',
  createdAt: now - 60_000,
  updatedAt: now - 60_000,
  ...over,
});

const base = { existing: [] as FeedbackItem[], username: 'u', now };

test('a bug report needs content, a feature request does not', () => {
  expect(
    checkNewFeedback({ ...base, category: 'bug', message: '  ' })
  ).toMatchObject({
    ok: false,
    status: 400,
  });
  expect(
    checkNewFeedback({
      ...base,
      category: 'feature',
      featureKey: 'music',
      message: '',
    })
  ).toEqual({ ok: true, message: '' });
});

test('rejects unknown category, unknown feature and over-long text', () => {
  expect(checkNewFeedback({ ...base, category: 'hack', message: 'x' }).ok).toBe(
    false
  );
  expect(
    checkNewFeedback({
      ...base,
      category: 'feature',
      featureKey: 'nope',
      message: 'x',
    }).ok
  ).toBe(false);
  expect(
    checkNewFeedback({ ...base, category: 'bug', message: 'a'.repeat(501) }).ok
  ).toBe(false);
});

test('feature request is refused when the user already has access', () => {
  const result = checkNewFeedback({
    ...base,
    category: 'feature',
    featureKey: 'music',
    message: 'x',
    alreadyHasAccess: true,
  });
  expect(result).toMatchObject({ ok: false, status: 400 });
});

test('rate limit, pending cap and duplicate feature requests', () => {
  expect(
    checkNewFeedback({
      ...base,
      category: 'bug',
      message: 'x',
      existing: [item({ createdAt: now - 1000 })],
    })
  ).toMatchObject({ ok: false, status: 429 });

  const many = Array.from({ length: FEEDBACK_MAX_PENDING_PER_USER }, () =>
    item()
  );
  expect(
    checkNewFeedback({ ...base, category: 'bug', message: 'x', existing: many })
  ).toMatchObject({ ok: false, status: 429 });

  expect(
    checkNewFeedback({
      ...base,
      category: 'feature',
      featureKey: 'music',
      message: 'x',
      existing: [item({ category: 'feature', featureKey: 'music' })],
    })
  ).toMatchObject({ ok: false, status: 409 });
});

test('parseFeedbackList tolerates garbage', () => {
  expect(parseFeedbackList(null)).toEqual([]);
  expect(parseFeedbackList('not json')).toEqual([]);
  expect(parseFeedbackList('{"a":1}')).toEqual([]);
  expect(
    parseFeedbackList(JSON.stringify([item(), { bad: true }]))
  ).toHaveLength(1);
});

test('trimFeedback drops the oldest handled records first and keeps pending ones', () => {
  const list: FeedbackItem[] = [
    item({ id: 'old-done', status: 'resolved', createdAt: 1 }),
    ...Array.from({ length: FEEDBACK_MAX_ITEMS }, (_, i) =>
      item({ id: `p${i}`, createdAt: 10 + i })
    ),
  ];
  const trimmed = trimFeedback(list);
  expect(trimmed).toHaveLength(FEEDBACK_MAX_ITEMS);
  expect(trimmed.find((entry) => entry.id === 'old-done')).toBeUndefined();
});
