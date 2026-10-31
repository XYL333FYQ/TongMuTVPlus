// 三端区分：App（安卓壳、安装到主屏幕的网页应用）、电脑客户端、普通网页。
//
// 以前各处用"触屏 + 屏幕宽度"去猜是不是 App，手机浏览器同样满足，于是浏览器里也被套上了
// App 的行为（禁回弹、自制下拉刷新……）。现在在页面最早期给 <html> 写一个明确的标记
// data-tm-platform，样式和脚本都按它分，不再靠猜。

export type TMPlatform = 'app' | 'desktop' | 'web';

/**
 * 内联到 <head> 里、在页面脚本之前执行的判断脚本（所以是字符串，且只用最朴素的语法）。
 * 判断依据都是客户端在页面加载前就放好的：
 *   - 安卓壳：UA 里带 TongMuTVPlusAndroid，或已挂上 TMShell 接口；
 *   - 电脑客户端：初始化脚本放的 __tmDesktopInit / TMDesktop；
 *   - 安装到主屏幕的网页应用（display-mode: standalone / fullscreen，iOS 的 navigator.standalone）：
 *     没有浏览器地址栏，体验上就是 App；
 *   - 其余都是普通网页。
 * 出任何意外都落到 web，保持浏览器原有行为。
 */
export const PLATFORM_BOOT_SCRIPT = `(function(){try{var w=window,d=document.documentElement,p='web';if(/TongMuTVPlusAndroid/.test(navigator.userAgent)||w.TMShell){p='app'}else if(w.__tmDesktopInit||w.TMDesktop){p='desktop'}else if(navigator.standalone===true||(w.matchMedia&&(w.matchMedia('(display-mode: standalone)').matches||w.matchMedia('(display-mode: fullscreen)').matches))){p='app'}d.setAttribute('data-tm-platform',p)}catch(e){}})();`;

/** 读取当前端；服务端渲染或脚本没跑时按普通网页处理 */
export function getPlatform(): TMPlatform {
  if (typeof document === 'undefined') return 'web';
  const value = document.documentElement.getAttribute('data-tm-platform');
  return value === 'app' || value === 'desktop' ? value : 'web';
}
