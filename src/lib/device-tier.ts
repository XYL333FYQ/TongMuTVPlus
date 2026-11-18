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

/** 内联到 <head>、在页面脚本之前执行：写档位，并在尺寸 / 方向变化时更新 */
export const DEVICE_TIER_BOOT_SCRIPT = `(function(){try{var compute=${computeDeviceTier.toString()};var d=document.documentElement,w=window,frame=0;function apply(){frame=0;var coarse=!!(w.matchMedia&&w.matchMedia('(pointer: coarse)').matches);var tier=compute(w.innerWidth,w.innerHeight,coarse);if(d.getAttribute('${DEVICE_TIER_ATTRIBUTE}')===tier)return;d.setAttribute('${DEVICE_TIER_ATTRIBUTE}',tier);try{w.dispatchEvent(new CustomEvent('${DEVICE_TIER_EVENT}',{detail:tier}))}catch(e){}}function schedule(){if(!frame)frame=w.requestAnimationFrame(apply)}apply();w.addEventListener('resize',schedule);w.addEventListener('orientationchange',schedule)}catch(e){}})();`;

const TIERS: DeviceTier[] = ['phone', 'phone-landscape', 'tablet', 'wide'];

/** 当前档位。脚本没跑（测试、服务端）时按窗口尺寸现算，服务端当电脑 */
export function getDeviceTier(): DeviceTier {
  if (typeof document === 'undefined') return 'wide';
  const value = document.documentElement.getAttribute(DEVICE_TIER_ATTRIBUTE);
  if (value && (TIERS as string[]).includes(value)) return value as DeviceTier;
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  return computeDeviceTier(window.innerWidth, window.innerHeight, coarse);
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
