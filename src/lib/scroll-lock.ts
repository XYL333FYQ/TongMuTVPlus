/**
 * 页面滚动锁（STANDARD.md 公共零件“滚动锁”）：弹窗、底部面板、看图打开时锁住页面。
 *
 * 按引用计数：两层弹窗叠着时，关掉上层页面仍然锁着，最后一层关掉才恢复。
 * 用 position: fixed + 负的 top 锁住，iOS Safari 上 overflow: hidden 锁不住；
 * 恢复时还原 body 原来的行内样式，再滚回原来的位置。
 */

type Saved = {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  overflow: string;
  scrollX: number;
  scrollY: number;
};

let holders = 0;
let saved: Saved | null = null;

function apply() {
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const widthBefore = document.documentElement.clientWidth;
  saved = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
    overflow: body.style.overflow,
    scrollX,
    scrollY,
  };
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = `-${scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  // 滚动条消失后可用宽度变大，差值就是滚动条宽：补给 body，页面不左右跳
  const scrollBarWidth = document.documentElement.clientWidth - widthBefore;
  if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;
}

function release() {
  if (!saved) return;
  const body = document.body;
  const { scrollX, scrollY, ...style } = saved;
  Object.assign(body.style, style);
  saved = null;
  // 等样式恢复后再滚回去
  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

/** 锁住页面滚动，返回解锁函数；同一个解锁函数调多次只算一次 */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (holders === 0) apply();
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) release();
  };
}
