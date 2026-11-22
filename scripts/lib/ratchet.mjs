// 计数棘轮：待清理名单（scripts/structure-allowlist.json）里的旧账按“键 ×数量”记，只许减少。
//
//   - 比名单多、或名单里没有的键 → 失败
//   - 比名单少 → 带 --shrink 时写回新数量，否则失败并提示 --shrink
//   - 变成 0 → 同上，键从名单删掉
//   - 新键的数量正好等于一个变成 0 的旧键 → 失败信息里提示“像是改名”
//
// 新类别只能用 baseline() 第一次生成；名单里已经有的类别（哪怕是空数组）拒绝重新生成，
// 免得用它把新增的旧账“洗白”。

const SEPARATOR = ' ×';
const ENTRY = /^(.*) ×(\d+)$/;

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function formatEntry(key, count) {
  return `${key}${SEPARATOR}${count}`;
}

/** 没有 “×N” 的旧格式按 1 计 */
export function parseEntry(entry) {
  const match = ENTRY.exec(entry);
  if (!match) return { key: entry, count: 1 };
  return { key: match[1], count: Number(match[2]) };
}

const toEntries = (counts) =>
  [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => byKey(a, b))
    .map(([key, count]) => formatEntry(key, count));

/**
 * @param {string} category  类别名，只用于失败信息
 * @param {Map<string, number>} found  这次统计到的数量
 * @param {string[]} allowed  名单里这个类别的条目
 * @param {boolean} shrink  是否把变少的数量写回
 * @returns {{ failures: string[], next: string[] }}  next 是写回名单用的新数组，按键排序
 */
export function compareCounts(category, found, allowed, shrink) {
  const failures = [];
  const limits = new Map();
  for (const entry of allowed) {
    const { key, count } = parseEntry(entry);
    if (limits.has(key)) failures.push(`[${category}] 名单里重复：${key}`);
    limits.set(key, count);
  }

  // 变成 0 的旧键，按数量分组，用来提示改名
  const gone = new Map();
  for (const [key, limit] of limits) {
    if ((found.get(key) ?? 0) === 0) {
      gone.set(limit, [...(gone.get(limit) ?? []), key]);
    }
  }

  const next = new Map();
  for (const [key, count] of found) {
    if (count <= 0) continue;
    const limit = limits.get(key);
    if (limit === undefined) {
      const renamedFrom = gone.get(count);
      const hint = renamedFrom
        ? `（像是改名：${renamedFrom.join(
            ' / '
          )} → ${key}，请在名单里把键改过来，数量不能增加）`
        : '';
      failures.push(`[${category}] 新增 ${formatEntry(key, count)}${hint}`);
    } else if (count > limit) {
      failures.push(`[${category}] ${key} ×${limit} → ×${count}`);
      next.set(key, limit);
    } else {
      next.set(key, count);
    }
  }

  for (const [key, limit] of limits) {
    const count = found.get(key) ?? 0;
    if (count >= limit) continue;
    if (shrink) continue; // next 里已经是新数量，或者变成 0 时不写
    failures.push(
      count === 0
        ? `[${category}] 已修好，请用 --shrink 从待清理名单删掉：${key}`
        : `[${category}] ${key} ×${limit} → ×${count}，变少了，请用 --shrink 写回名单`
    );
    next.set(key, limit);
  }

  return { failures, next: toEntries(next) };
}

/** 第一次给一个新类别生成旧账名单；名单里已有这个类别就拒绝 */
export function baseline(category, found, allowlist) {
  if (Object.hasOwn(allowlist, category)) {
    throw new Error(
      `待清理名单里已经有类别 ${category}，不能重新生成基线（旧账只许减少）`
    );
  }
  return toEntries(found);
}
