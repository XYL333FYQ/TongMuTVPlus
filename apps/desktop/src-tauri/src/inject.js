// 注入到每个页面（包括远端网站）的脚本，由 main.rs 用 include_str! 打进程序。
//   Ctrl+Shift+S  回到本地页，更换服务器地址
//   F11           切换全屏（走浏览器 Fullscreen API）
//   窗口按钮      无系统标题栏，右上角由页面自己画最小化 / 最大化 / 关闭，
//                 顶栏空白处按住拖动、双击最大化。按钮就在网页里，
//                 所以切主题时和网页是同一次渐变，不存在“传消息”的延迟。
(function () {
  if (window.__tmDesktopInit) return;
  window.__tmDesktopInit = true;

  var HOME = '__HOME__';
  // 三个按钮各 46px 宽，顶栏右侧的操作区要让出这块位置
  var CONTROLS_WIDTH = 138;

  // 调用壳里的命令；失败一律忽略（比如在回退窗口里没有这个通道）
  function invoke(cmd, args) {
    try {
      var t = window.__TAURI_INTERNALS__;
      if (t && typeof t.invoke === 'function') {
        var p = t.invoke(cmd, args);
        if (p && typeof p.then === 'function') {
          return p.then(null, function () {
            return null;
          });
        }
      }
    } catch (e) {}
    return Promise.resolve(null);
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

  // ---------- 全屏：网页里的全屏按钮和 F11 都会触发这个事件，让窗口也跟着全屏 ----------
  document.addEventListener('fullscreenchange', function () {
    invoke('tm_fullscreen', { on: !!document.fullscreenElement });
  });

  // ---------- 页面样式：不往页面里加节点，用可构造样式表 ----------
  // 顶栏右侧的“搜索、主题、头像”整体左移，给窗口按钮让位；其他网站没有这个类名，不受影响
  try {
    var pageSheet = new CSSStyleSheet();
    pageSheet.replaceSync(
      '.tm-header-actions { margin-inline-end: ' + CONTROLS_WIDTH + 'px; }'
    );
    document.adoptedStyleSheets = document.adoptedStyleSheets.concat(pageSheet);
  } catch (e) {}

  // ---------- 窗口按钮 ----------
  var SHADOW_CSS =
    ':host { all: initial; }' +
    // 颜色优先用站点的 --tm-*；没有就用 refreshColors() 从页面实际背景 / 文字色取到的 --tm-shell-*
    '.ctls { position: fixed; top: 0; right: 0; z-index: 2147483647; display: flex; height: 32px;' +
    ' border-bottom-left-radius: 10px; color: var(--tm-text, var(--tm-shell-fg, CanvasText));' +
    ' background: color-mix(in srgb, var(--tm-bg, var(--tm-shell-bg, Canvas)) 72%, transparent);' +
    ' -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);' +
    ' font: 12px/1 sans-serif; }' +
    ':host-context(html[data-tm-no-blur]) .ctls { background: var(--tm-bg, var(--tm-shell-bg, Canvas));' +
    ' -webkit-backdrop-filter: none; backdrop-filter: none; }' +
    '.btn { display: grid; place-items: center; width: 46px; height: 32px; padding: 0; border: 0;' +
    ' background: transparent; color: inherit; cursor: default; }' +
    '.btn:first-child { border-bottom-left-radius: 10px; }' +
    '.btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }' +
    '.btn:active { background: color-mix(in srgb, currentColor 18%, transparent); }' +
    '.btn:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; }' +
    '.btn.close:hover, .btn.close:active { background: var(--tm-danger, #e5484d); color: #fff; }' +
    'svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1; pointer-events: none; }' +
    '.restore { display: none; }' +
    ':host([data-max]) .restore { display: block; }' +
    ':host([data-max]) .max { display: none; }' +
    '.drag { position: fixed; top: 0; left: 0; right: ' +
    CONTROLS_WIDTH +
    'px; height: 10px;' +
    ' z-index: 2147483646; }' +
    ':host-context(html:fullscreen) .ctls, :host-context(html:fullscreen) .drag { display: none; }';

  var SHADOW_HTML =
    '<div class="drag"></div>' +
    '<div class="ctls" role="group" aria-label="窗口控制">' +
    '<button type="button" class="btn" data-act="minimize" aria-label="最小化" title="最小化">' +
    '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5.5h10"/></svg></button>' +
    '<button type="button" class="btn" data-act="toggle-maximize" aria-label="最大化" title="最大化">' +
    '<svg class="max" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9"/></svg>' +
    '<svg class="restore" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="2.5" width="7" height="7"/><path d="M2.5 2.5v-2h7v7h-2"/></svg></button>' +
    '<button type="button" class="btn close" data-act="close" aria-label="关闭" title="关闭">' +
    '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9"/></svg></button>' +
    '</div>';

  var host = null;

  function setMax(v) {
    if (!host) return;
    if (v) host.setAttribute('data-max', '');
    else host.removeAttribute('data-max');
    var label = v ? '向下还原' : '最大化';
    var b =
      host.shadowRoot &&
      host.shadowRoot.querySelector('[data-act="toggle-maximize"]');
    if (b) {
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    }
  }

  function act(name) {
    invoke('tm_window', { action: name }).then(function (m) {
      if (typeof m === 'boolean') setMax(m);
    });
  }

  // 本站有 --tm-bg / --tm-text 就直接用（随主题过渡）；其他页面（本地填地址页、别的网站）
  // 取页面实际的背景色和文字色，免得深色页面上冒出一块浅色底板
  function solid(c) {
    // 浏览器把全透明报成 rgba(0, 0, 0, 0)；rgb(0, 0, 0) 是不透明的黑，别误判
    return c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c) ? c : '';
  }
  function refreshColors() {
    if (!host || !document.body) return;
    var rs = getComputedStyle(document.documentElement);
    if (rs.getPropertyValue('--tm-bg').trim()) {
      host.style.removeProperty('--tm-shell-bg');
      host.style.removeProperty('--tm-shell-fg');
      return;
    }
    var bs = getComputedStyle(document.body);
    var bg = solid(bs.backgroundColor) || solid(rs.backgroundColor);
    if (bg) host.style.setProperty('--tm-shell-bg', bg);
    else host.style.removeProperty('--tm-shell-bg');
    host.style.setProperty('--tm-shell-fg', bs.color);
  }

  function mount() {
    if (!document.body) return;
    if (host && host.isConnected) return;
    if (!host) {
      host = document.createElement('tm-shell-controls');
      // 开着 open 模式，调试时能在开发者工具里看到
      var root = host.attachShadow({ mode: 'open' });
      try {
        var sheet = new CSSStyleSheet();
        sheet.replaceSync(SHADOW_CSS);
        root.adoptedStyleSheets = [sheet];
      } catch (e) {}
      root.innerHTML = SHADOW_HTML;
      root.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.btn');
        if (b) act(b.getAttribute('data-act'));
      });
      root.querySelector('.drag').addEventListener('mousedown', function (e) {
        if (e.button === 0) act(e.detail >= 2 ? 'toggle-maximize' : 'drag');
      });
    }
    // 追加在 body 末尾：React 水合时对 body 末尾多出来的节点是放过的
    document.body.appendChild(host);
    refreshColors();
    act('state');
  }

  // 顶栏的空白处也能拖动窗口、双击最大化（点在链接、按钮、输入框上不算）
  var INTERACTIVE =
    'a,button,input,select,textarea,summary,label,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[tabindex]';
  document.addEventListener(
    'mousedown',
    function (e) {
      if (e.button !== 0) return;
      var t = e.target;
      if (!t || !t.closest || !t.closest('.tm-top-header')) return;
      if (t.closest(INTERACTIVE)) return;
      act(e.detail >= 2 ? 'toggle-maximize' : 'drag');
    },
    true
  );

  // 窗口大小变了（含贴边、快捷键最大化）：重新问一次是否最大化
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      act('state');
    }, 80);
  });

  function start() {
    mount();
    // 页面框架万一把它清掉了，自动补回来
    new MutationObserver(function () {
      if (host && !host.isConnected) mount();
    }).observe(document.body, { childList: true });
    // 样式表陆续加载、页面自己换色时，隔一会儿对一次
    window.addEventListener('load', refreshColors);
    setInterval(refreshColors, 1500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
