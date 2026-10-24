import { createRequestGate } from './request-gate';

test('only the most recently started request is current', () => {
  const gate = createRequestGate();
  const a = gate.begin();
  expect(a.isCurrent()).toBe(true);
  const b = gate.begin();
  expect(a.isCurrent()).toBe(false);
  expect(b.isCurrent()).toBe(true);
});

test('a late response from an older request is ignored regardless of finish order', async () => {
  const gate = createRequestGate();
  const shown: string[] = [];
  const load = async (name: string, delay: number) => {
    const request = gate.begin();
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (request.isCurrent()) shown.push(name);
  };
  // 先点 A（慢），再点 B（快）：最后显示的必须是 B
  await Promise.all([load('A', 30), load('B', 5)]);
  expect(shown).toEqual(['B']);
});
