// 手机底栏"滑块"在切页之间的连续性。
// 每个页面各带一份底栏，切页时底栏整个重建；如果新底栏一出生滑块就在新位置，
// 看起来就是"瞬移"。这里在模块里记住滑块上一刻的位置与去向，新底栏从那里出发，
// 滑向新位置——即使切一次页底栏重建了好几次（占位 → 真页面），滑块也一路连续。

export interface Thumb {
  left: number;
  width: number;
}

/** 与 shell.css 里 .tm-mobile-nav-thumb 的 transform 过渡时长一致 */
export const THUMB_MS = 320;

interface Motion {
  from: number;
  to: number;
  width: number;
  at: number;
}

let motion: Motion | null = null;

// 近似 cubic-bezier(0.22, 1, 0.36, 1)（先快后慢）
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

/** 滑块此刻应在的位置；还没有记录时为 null。 */
export function thumbNow(now = performance.now()): Thumb | null {
  if (!motion) return null;
  const t = Math.min(1, Math.max(0, (now - motion.at) / THUMB_MS));
  return {
    left: motion.from + (motion.to - motion.from) * ease(t),
    width: motion.width,
  };
}

/** 滑块要去往新位置：从它此刻所在处出发。去向没变就只更新宽度，不重新计时。 */
export function retargetThumb(next: Thumb | null, now = performance.now()) {
  if (!next) {
    motion = null;
    return;
  }
  if (motion && motion.to === next.left) {
    motion.width = next.width;
    return;
  }
  const current = thumbNow(now);
  motion = {
    from: current ? current.left : next.left,
    to: next.left,
    width: next.width,
    at: now,
  };
}

/** 手指拖动时：滑块就在手指处，没有过渡。 */
export function pinThumb(thumb: Thumb, now = performance.now()) {
  motion = { from: thumb.left, to: thumb.left, width: thumb.width, at: now };
}

export function resetThumbMotion() {
  motion = null;
}
