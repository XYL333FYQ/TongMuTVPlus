// 手机底栏"滑块"在切页之间的连续性。
// 普通切页由持久外壳保留底栏。这里额外记住滑块的位置与去向，
// 在底栏确实重新挂载时恢复连续性；这不是整条底栏的进场动画。

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
