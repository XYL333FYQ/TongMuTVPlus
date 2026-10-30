// 常驻顶栏与当前页面之间的"传话筒"。
//
// 顶栏现在只有一份，常驻在根布局里（见 PersistentHeader），切页时不再整个销毁重建
// （顶栏里有约 5000 行的账号菜单，手机、桌面各一份，以前每切一次页都要重新挂载两遍）。
// 页面通过 PageLayout 把自己的顶栏需求（指定的标题、当前栏目、是否自带一级标题等）写到这里，
// 顶栏读出来显示。同一时刻可能有两个 PageLayout（加载占位 + 真页面，或播放器 + 页面），
// 以最后挂载、仍在的那个为准。
import type { ReactNode } from 'react';

export interface PageHeaderRequest {
  activePath?: string;
  mobileTitle?: string;
  mobileSubtitle?: ReactNode;
  mobileActions?: ReactNode;
  pageHasHeading?: boolean;
}

type Listener = () => void;

const entries: Array<{ id: string; request: PageHeaderRequest }> = [];
const listeners = new Set<Listener>();
let current: PageHeaderRequest | null = null;

function emit() {
  current = entries.length ? entries[entries.length - 1].request : null;
  listeners.forEach((listener) => listener());
}

/** 页面挂载时登记、内容变化时更新；返回注销函数 */
export function publishPageHeader(id: string, request: PageHeaderRequest) {
  const existing = entries.find((entry) => entry.id === id);
  if (existing) existing.request = request;
  else entries.push({ id, request });
  emit();
}

export function withdrawPageHeader(id: string) {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  entries.splice(index, 1);
  emit();
}

export function subscribePageHeader(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPageHeader(): PageHeaderRequest | null {
  return current;
}

/** 服务端渲染与首次注水时：还没有页面登记，按地址推断 */
export function getServerPageHeader(): PageHeaderRequest | null {
  return null;
}
