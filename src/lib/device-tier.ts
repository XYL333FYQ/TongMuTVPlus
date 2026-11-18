// 设备档位：全站“按什么设备排版”只在这里定义一次。
//
// 以前每个模块各用各的宽度分界（599、767、899、1023、1199……），只看宽度不看横竖：
// 平板横屏宽度不到 1200，房间页就按手机排；横屏手机宽度超过 768，又被当成电脑。
// 现在在页面最早期给 <html> 写上 data-tm-device，样式（属性选择器）、Tailwind（wide: 等变体）、
// React（useDeviceTier）和播放器脚本（getDeviceTier）都读这一个值。
//
// 四档：
//   phone            手机竖着拿（以及宽度不到 600 的窗口）
//   phone-landscape  手机横着拿：触屏、横向、高度不到 480
//   tablet           大屏竖着拿（平板竖屏、竖长的电脑窗口）
//   wide             大屏横着拿（平板横屏、电脑）——和电脑同一套排版
//
// 单个组件“这一块放不放得下”仍可以用宽度媒体查询；“整页按哪套排版”一律用档位。

export type DeviceTier = 'phone' | 'phone-landscape' | 'tablet' | 'wide';

export const DEVICE_TIER_ATTRIBUTE = 'data-tm-device';
/** 档位变化时在 window 上派发的事件 */
export const DEVICE_TIER_EVENT = 'tm-device-tier';

/**
 * 档位规则本身。boot 脚本把这个函数原样内联进 <head>，所以只能用最朴素的语法、不引用外部变量。
 */
export function computeDeviceTier(
  width: number,
  height: number,
  coarsePointer: boolean
): DeviceTier {
  const landscape = width > height;
  if (landscape && coarsePointer && height < 480) return 'phone-landscape';
  if (width < 600) return 'phone';
  if (!landscape) return 'tablet';
  return 'wide';
}

/**
 * 排版用的高度：软键盘弹出时不算数。
 *
 * 安卓 App（adjustResize）和部分浏览器在键盘弹出时把窗口高度压矮：平板横屏 1280×800
 * 弹出键盘后只剩四百多，会被当成“横屏手机”整页换排版，正在输入的框跟着被换掉、键盘立刻收回，
 * 看起来就是“点输入框没反应”。所以宽度没变、正在输入、高度变矮时，沿用键盘弹出前的高度。
 * 同样只能用最朴素的语法（boot 脚本内联）。
 */
export function settleLayoutHeight(
  memory: { width: number; height: number },
  width: number,
  height: number,
  typing: boolean
): number {
  if (width === memory.width && typing && height < memory.height)
    return memory.height;
  memory.width = width;
  memory.height = height;
  return height;
}

/** 正在输入：焦点在可输入的框里，或 App 壳告诉我们键盘开着 */
export function isTyping(doc: Document): boolean {
  const active = doc.activeElement as HTMLElement | null;
  if (doc.documentElement.getAttribute('data-tm-keyboard') === 'open')
    return true;
  if (!active) return false;
  return (
    active.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName || '')
  );
}

/** 内联到 <head>、在页面脚本之前执行：写档位，并在尺寸 / 方向变化时更新 */
export const DEVICE_TIER_BOOT_SCRIPT = `(function(){try{var compute=${computeDeviceTier.toString()};var settle=${settleLayoutHeight.toString()};var typing=${isTyping.toString()};var d=document.documentElement,w=window,frame=0,memory={width:0,height:0};function apply(){frame=0;var coarse=!!(w.matchMedia&&w.matchMedia('(pointer: coarse)').matches);var height=settle(memory,w.innerWidth,w.innerHeight,typing(document));var tier=compute(w.innerWidth,height,coarse);if(d.getAttribute('${DEVICE_TIER_ATTRIBUTE}')===tier)return;d.setAttribute('${DEVICE_TIER_ATTRIBUTE}',tier);try{w.dispatchEvent(new CustomEvent('${DEVICE_TIER_EVENT}',{detail:tier}))}catch(e){}}function schedule(){if(!frame)frame=w.requestAnimationFrame(apply)}apply();w.addEventListener('resize',schedule);w.addEventListener('orientationchange',schedule)}catch(e){}})();`;

const TIERS: DeviceTier[] = ['phone', 'phone-landscape', 'tablet', 'wide'];

/** 当前档位。脚本没跑（测试、服务端）时按窗口尺寸现算，服务端当电脑 */
export function getDeviceTier(): DeviceTier {
  if (typeof document === 'undefined') return 'wide';
  const value = document.documentElement.getAttribute(DEVICE_TIER_ATTRIBUTE);
  if (value && (TIERS as string[]).includes(value)) return value as DeviceTier;
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  return computeDeviceTier(window.innerWidth, window.innerHeight, coarse);
}

/**
 * 页面排版：档位 + 是不是触屏（2026-11-18 用户要求电脑 / 平板 / 手机各有一套）。
 *   compact  手机竖横两档；以及竖长的电脑窗口
 *   tablet   触屏的平板，横竖都是（横屏也不照搬电脑）
 *   desktop  鼠标操作的大屏（电脑网页、电脑客户端）
 * 档位只看尺寸，“是不是平板”要再看触屏：同样 1280×800，平板和电脑是两套。
 */
export type PageLayout = 'compact' | 'tablet' | 'desktop';

export function pageLayoutFor(tier: DeviceTier, coarse: boolean): PageLayout {
  if (isHandheld(tier)) return 'compact';
  if (coarse) return 'tablet';
  return tier === 'wide' ? 'desktop' : 'compact';
}

/** 主要指针是不是手指 */
export function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(pointer: coarse)').matches
  );
}

/** 手机（竖或横） */
export function isHandheld(tier: DeviceTier = getDeviceTier()) {
  return tier === 'phone' || tier === 'phone-landscape';
}

/** 订阅档位变化，返回取消函数 */
export function onDeviceTierChange(listener: (tier: DeviceTier) => void) {
  const handler = () => listener(getDeviceTier());
  window.addEventListener(DEVICE_TIER_EVENT, handler);
  return () => window.removeEventListener(DEVICE_TIER_EVENT, handler);
}
