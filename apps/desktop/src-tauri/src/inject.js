// 注入到页面区每个页面（包括远端网站）的脚本，由 main.rs 用 include_str! 打进程序。
//   Ctrl+Shift+S  回到本地页，更换服务器地址
//   F11           切换全屏（走浏览器 Fullscreen API）
//   全屏状态      告诉壳：全屏时收起标题条，页面铺满整个窗口
//   主题颜色      告诉壳：标题条跟着页面换色，切主题时和页面同一个圆形扩散
// 只读页面现有的 CSS 变量和属性，不改页面里任何东西。
(function () {
  if (window.__tmDesktopInit) return;
  window.__tmDesktopInit = true;

  var HOME = '__HOME__';
  var DEFAULT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var SAFE = /^[A-Za-z0-9 #(),.%\/-]{1,80}$/;

  // ---------- 与壳通信（失败一律忽略：浏览器里或回退窗口里没有这个通道） ----------
  function invoke(cmd, args) {
    try {
      var t = window.__TAURI_INTERNALS__;
      if (t && typeof t.invoke === 'function') {
        var p = t.invoke(cmd, args);
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    } catch (e) {}
  }

  // ---------- 快捷键 ----------
  window.addEventListener(
    'keydown',
    function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        location.href = HOME + '?change=1';
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    },
    true
  );

  // ---------- 全屏：网页里的全屏按钮和 F11 都会触发这个事件 ----------
  document.addEventListener('fullscreenchange', function () {
    invoke('tm_fullscreen', { on: !!document.fullscreenElement });
  });

  // ---------- 主题颜色 ----------
  var ctx = null;
  // 借 canvas 把任意 CSS 颜色规范成 #rrggbb 或 rgba(...)，不往页面里加任何节点
  function normalize(color) {
    try {
      if (!color) return '';
      if (!ctx) ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = '#010203';
      ctx.fillStyle = color;
      var v = ctx.fillStyle;
      if (typeof v !== 'string') return '';
      if (
        v === '#010203' &&
        color.replace(/\s/g, '').toLowerCase() !== '#010203'
      )
        return '';
      return v;
    } catch (e) {
      return '';
    }
  }

  function channels(c) {
    var m;
    if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c))) {
      return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    }
    if ((m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c))) {
      return [+m[1], +m[2], +m[3]];
    }
    return [0, 0, 0];
  }

  function isDarkColor(c) {
    var ch = channels(c);
    return (0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]) / 255 < 0.5;
  }

  // 完全透明的颜色当作没有
  function opaque(c) {
    var v = normalize(c);
    return !v || /,\s*0\)$/.test(v) ? '' : v;
  }

  function readColors() {
    var root = document.documentElement;
    if (!root) return null;
    var cs = getComputedStyle(root);
    // 本站：直接读主题 token，内置主题和站长自定义主题也跟得上
    var bg = normalize(cs.getPropertyValue('--tm-bg').trim());
    var fg = normalize(cs.getPropertyValue('--tm-text').trim());
    if (!bg || !fg) {
      // 其他网站、本地的填地址页：退回页面实际的背景色和文字色
      var body = document.body;
      var bs = body ? getComputedStyle(body) : null;
      bg =
        (bs && opaque(bs.backgroundColor)) ||
        opaque(cs.backgroundColor) ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches
          ? '#0b0b0d'
          : '#ffffff');
      fg =
        (bs && normalize(bs.color)) ||
        (isDarkColor(bg) ? '#f2f2f3' : '#0f0f10');
    }
    return { bg: bg, fg: fg };
  }

  function parseMs(v) {
    var n = parseFloat(v);
    if (!(n > 0)) return 0;
    return /ms\s*$/.test(v) || !/s\s*$/.test(v) ? n : n * 1000;
  }

  function reducedMotion() {
    return (
      document.documentElement.dataset.tmReducedMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // 这次换色该用什么动画：本站的圆形扩散就照搬圆心、半径、时长、缓动；其他情况 250ms 渐变
  function animation() {
    if (reducedMotion()) return { kind: 'none' };
    var root = document.documentElement;
    var cs = getComputedStyle(root);
    var ms = parseMs(cs.getPropertyValue('--tm-d-theme').trim()) || 520;
    var ease = cs.getPropertyValue('--tm-ease-theme').trim();
    if (!SAFE.test(ease)) ease = DEFAULT_EASE;
    if (root.dataset.tmThemeTransition === 'circle') {
      // 站点切主题时会把圆心和半径写在 <html> 的 --tm-theme-x/y/r 上，直接读
      var x = parseFloat(cs.getPropertyValue('--tm-theme-x'));
      var y = parseFloat(cs.getPropertyValue('--tm-theme-y'));
      var r = parseFloat(cs.getPropertyValue('--tm-theme-r'));
      if (!(isFinite(x) && isFinite(y) && r > 0)) {
        // 没有就按触发按钮的位置自己算，半径算法与站点 theme-transition.ts 一致
        var origin = document.querySelector('[data-tm-theme-origin="true"]');
        if (!origin) return { kind: 'fade', ms: 250, ease: ease };
        var rect = origin.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
        r = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
      }
      return { kind: 'circle', x: x, y: y, r: r, ms: ms, ease: ease };
    }
    return { kind: 'fade', ms: 250, ease: ease };
  }

  // 目标是不是深色：深色时站点让旧画面向按钮收缩，浅色时让新画面从按钮扩散
  function targetDark(bg) {
    var cl = document.documentElement.classList;
    if (cl.contains('dark')) return true;
    if (cl.contains('light')) return false;
    return isDarkColor(bg);
  }

  // 现在的 epoch 毫秒（带小数），页面和标题条是两个进程，但系统时钟是同一个
  function nowEpoch() {
    return performance.timeOrigin + performance.now();
  }

  // 找站点自己的圆形扩散动画（挂在 ::view-transition 伪元素上、关键帧里有 clipPath 的那条）
  // 同时存在好几条时取开始得最晚的（还没开始的算最晚），避开上一次残留的
  function findThemeAnimation() {
    var list = document.getAnimations ? document.getAnimations() : [];
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i].effect;
      if (
        !e ||
        !e.pseudoElement ||
        e.pseudoElement.indexOf('::view-transition') !== 0
      )
        continue;
      var kf = e.getKeyframes ? e.getKeyframes() : [];
      var hasClip = false;
      for (var j = 0; j < kf.length; j++) {
        if ('clipPath' in kf[j]) hasClip = true;
      }
      if (!hasClip) continue;
      var st = list[i].startTime;
      if (typeof st !== 'number') return list[i];
      if (!best || st > best.startTime) best = list[i];
    }
    return best;
  }

  function send(c, a, start) {
    invoke('tm_sync', {
      bg: c.bg,
      fg: c.fg,
      kind: a.kind,
      x: a.x || 0,
      y: a.y || 0,
      r: a.r || 0,
      ms: a.ms || 0,
      ease: a.ease || DEFAULT_EASE,
      dark: targetDark(c.bg),
      start: start,
    });
  }

  var last = '';
  var seq = 0;
  function sync() {
    var c = readColors();
    if (!c || !SAFE.test(c.bg) || !SAFE.test(c.fg)) return;
    var key = c.bg + '|' + c.fg;
    if (key === last) return;
    var first = last === '';
    last = key;
    var mine = ++seq;
    var flipped = nowEpoch();
    // 页面刚加载的前 1.2 秒只是样式陆续生效，不播动画
    var a = first || performance.now() < 1200 ? { kind: 'none' } : animation();
    if (a.kind !== 'circle') {
      send(c, a, flipped);
      return;
    }
    // 站点是等新旧画面截好才开始放圆形动画，比主题 class 变化晚几帧。
    // 跨进程传消息一定有延迟，所以不靠"收到消息就开始"，而是把页面动画真正开始的时刻
    // 一起告诉标题条，标题条按这个时刻算出自己该走到哪一帧，延迟再大也对得上。
    var tries = 0;
    (function poll() {
      if (mine !== seq) return; // 又切了一次主题，这次作废
      var anim = findThemeAnimation();
      var st = anim ? anim.startTime : null;
      // 只认变色之后才开始的动画，上一次切换残留的不算
      if (
        typeof st === 'number' &&
        performance.timeOrigin + st >= flipped - 30
      ) {
        send(c, a, performance.timeOrigin + st);
      } else if (++tries > 175) {
        // 等了约 700ms 还没等到（动画被跳过等），按变色时刻估一个起点
        send(c, a, flipped + 50);
      } else {
        setTimeout(poll, 4);
      }
    })();
  }

  function watch(node) {
    if (node) new MutationObserver(sync).observe(node, { attributes: true });
  }

  function armRoot() {
    if (!document.documentElement) return false;
    watch(document.documentElement);
    return true;
  }
  if (!armRoot()) {
    new MutationObserver(function (_, o) {
      if (armRoot()) o.disconnect();
    }).observe(document, { childList: true });
  }
  document.addEventListener('DOMContentLoaded', function () {
    watch(document.body);
    sync();
  });
  window.addEventListener('load', sync);
  window.addEventListener('pageshow', sync);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () {
      setTimeout(sync, 60);
    });
  // 兜底：不是靠属性变化换色的网站，每 1.5 秒对一次
  setInterval(sync, 1500);
})();
