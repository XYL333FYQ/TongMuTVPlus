import {
  type FeaturePermissionKey,
  ALL_FEATURE_PERMISSION_KEYS,
} from '@/lib/feature-permissions';

// 用户给站长的反馈与功能申请。数据量小（小圈子站点），
// 整体存成一条 JSON 放在通用键值存储里，不需要新建数据表。

export const FEEDBACK_STORAGE_KEY = 'tongmu:feedback:v1';
export const FEEDBACK_MAX_ITEMS = 500;
export const FEEDBACK_MAX_MESSAGE = 500;
export const FEEDBACK_MAX_PENDING_PER_USER = 5;
export const FEEDBACK_MIN_INTERVAL_MS = 15_000;

export const FEEDBACK_CATEGORIES = [
  { value: 'feature', label: '申请功能', hint: '想用某个还没开放给你的功能' },
  { value: 'bug', label: '问题反馈', hint: '遇到报错、卡顿或不对劲的地方' },
  { value: 'suggestion', label: '建议', hint: '希望增加或改进什么' },
  { value: 'other', label: '其他', hint: '不属于以上几类' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];
export type FeedbackStatus = 'pending' | 'approved' | 'rejected' | 'resolved';

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending: '待处理',
  approved: '已同意',
  rejected: '已拒绝',
  resolved: '已处理',
};

export interface FeedbackItem {
  id: string;
  username: string;
  category: FeedbackCategory;
  featureKey?: FeaturePermissionKey;
  message: string;
  status: FeedbackStatus;
  reply?: string;
  handledBy?: string;
  createdAt: number;
  updatedAt: number;
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((item) => item.value === value);
}

export function isFeatureKey(value: unknown): value is FeaturePermissionKey {
  return ALL_FEATURE_PERMISSION_KEYS.includes(value as FeaturePermissionKey);
}

export function parseFeedbackList(raw: string | null): FeedbackItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FeedbackItem =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.username === 'string' &&
        isFeedbackCategory(item.category) &&
        typeof item.message === 'string'
    );
  } catch {
    return [];
  }
}

export type NewFeedbackCheck =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

// 提交前的校验（与存储无关，便于测试）
export function checkNewFeedback(input: {
  category: unknown;
  featureKey?: unknown;
  message: unknown;
  existing: FeedbackItem[];
  username: string;
  now: number;
  alreadyHasAccess?: boolean;
}): NewFeedbackCheck {
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!isFeedbackCategory(input.category)) {
    return { ok: false, error: '请选择反馈类型', status: 400 };
  }
  if (!message && input.category !== 'feature') {
    return { ok: false, error: '请写一下具体内容', status: 400 };
  }
  if (message.length > FEEDBACK_MAX_MESSAGE) {
    return {
      ok: false,
      error: `内容不能超过 ${FEEDBACK_MAX_MESSAGE} 字`,
      status: 400,
    };
  }
  const mine = input.existing.filter(
    (item) => item.username === input.username
  );
  if (
    mine.some((item) => input.now - item.createdAt < FEEDBACK_MIN_INTERVAL_MS)
  ) {
    return { ok: false, error: '提交太频繁，请稍后再试', status: 429 };
  }
  const pending = mine.filter((item) => item.status === 'pending');
  if (pending.length >= FEEDBACK_MAX_PENDING_PER_USER) {
    return {
      ok: false,
      error: `待处理的反馈已有 ${FEEDBACK_MAX_PENDING_PER_USER} 条，请等站长处理后再提交`,
      status: 429,
    };
  }
  if (input.category === 'feature') {
    if (!isFeatureKey(input.featureKey)) {
      return { ok: false, error: '请选择要申请的功能', status: 400 };
    }
    if (input.alreadyHasAccess) {
      return { ok: false, error: '你已经可以使用这个功能了', status: 400 };
    }
    if (
      pending.some(
        (item) =>
          item.category === 'feature' && item.featureKey === input.featureKey
      )
    ) {
      return {
        ok: false,
        error: '这个功能已经申请过了，请等待处理',
        status: 409,
      };
    }
  }
  return { ok: true, message };
}

// 单进程内串行读改写，避免两个请求同时写覆盖对方
let queue: Promise<unknown> = Promise.resolve();
export function withFeedbackLock<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export function trimFeedback(list: FeedbackItem[]): FeedbackItem[] {
  if (list.length <= FEEDBACK_MAX_ITEMS) return list;
  // 超出上限时先丢最旧的已处理记录，待处理的尽量保留
  const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
  let excess = sorted.length - FEEDBACK_MAX_ITEMS;
  const dropped = new Set<string>();
  for (const item of sorted) {
    if (excess <= 0) break;
    if (item.status !== 'pending') {
      dropped.add(item.id);
      excess -= 1;
    }
  }
  for (const item of sorted) {
    if (excess <= 0) break;
    if (!dropped.has(item.id)) {
      dropped.add(item.id);
      excess -= 1;
    }
  }
  return list.filter((item) => !dropped.has(item.id));
}
