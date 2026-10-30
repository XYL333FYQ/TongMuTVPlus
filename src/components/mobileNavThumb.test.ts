import {
  THUMB_MS,
  pinThumb,
  resetThumbMotion,
  retargetThumb,
  thumbNow,
} from './mobileNavThumb';

beforeEach(resetThumbMotion);

describe('底栏滑块在切页之间的连续性', () => {
  it('还没有记录时没有位置（首次进入，滑块直接出现在选中项上）', () => {
    expect(thumbNow(0)).toBeNull();
  });

  it('第一次定位不产生滑动', () => {
    retargetThumb({ left: 60, width: 60 }, 0);
    expect(thumbNow(0)?.left).toBe(60);
    expect(thumbNow(THUMB_MS)?.left).toBe(60);
  });

  it('换到新位置：新底栏出生时滑块还在旧位置，随后滑向新位置', () => {
    retargetThumb({ left: 60, width: 60 }, 0);
    retargetThumb({ left: 240, width: 60 }, 1000);
    expect(thumbNow(1000)?.left).toBe(60);
    const mid = thumbNow(1000 + THUMB_MS / 2)?.left ?? 0;
    expect(mid).toBeGreaterThan(60);
    expect(mid).toBeLessThan(240);
    expect(thumbNow(1000 + THUMB_MS)?.left).toBe(240);
  });

  it('一次切页底栏重建多次（占位 → 真页面）：从滑块此刻的位置继续，不跳到终点', () => {
    retargetThumb({ left: 60, width: 60 }, 0);
    retargetThumb({ left: 240, width: 60 }, 1000);
    const at = 1000 + 100;
    const before = thumbNow(at)?.left ?? 0;
    // 第二个底栏在 100ms 时出生，沿用同一个去向
    retargetThumb({ left: 240, width: 60 }, at);
    expect(thumbNow(at)?.left).toBeCloseTo(before, 5);
    // 去向没变，不重新计时：到 320ms 时仍然到达终点
    expect(thumbNow(1000 + THUMB_MS)?.left).toBe(240);
  });

  it('中途改去别处：从当前位置出发', () => {
    retargetThumb({ left: 60, width: 60 }, 0);
    retargetThumb({ left: 240, width: 60 }, 1000);
    const at = 1000 + 100;
    const here = thumbNow(at)?.left ?? 0;
    retargetThumb({ left: 120, width: 60 }, at);
    expect(thumbNow(at)?.left).toBeCloseTo(here, 5);
    expect(thumbNow(at + THUMB_MS)?.left).toBe(120);
  });

  it('手指拖动：滑块固定在手指处，之后从那里出发', () => {
    retargetThumb({ left: 60, width: 60 }, 0);
    pinThumb({ left: 170, width: 60 }, 500);
    expect(thumbNow(500)?.left).toBe(170);
    retargetThumb({ left: 240, width: 60 }, 600);
    expect(thumbNow(600)?.left).toBe(170);
  });
});
