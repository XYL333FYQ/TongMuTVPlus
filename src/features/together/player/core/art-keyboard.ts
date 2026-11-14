// ArtPlayer 的工具栏、设置面板和下拉选项都是 div，没有 tabindex 和按钮语义，
// 键盘用户按 Tab 会整排跳过（AUDIT ROOM-17）。这里只补可达性：
// 让这些入口可聚焦、带 role=button，并把 Enter / 空格转成一次点击，
// 点击后的行为仍由 ArtPlayer 原有的 click 处理，不改播放逻辑。

const FOCUSABLE_SELECTOR = [
  '.art-control',
  '.art-setting-item',
  '.art-selector-item',
].join(',');

// 只负责展示、本身没有点击行为的控件（进度条、时间、缩略图预览、弹幕热力图）
const DISPLAY_ONLY = [
  'art-control-progress',
  'art-control-time',
  'art-control-thumbnails',
  'art-control-custom-heatmap',
];

// ArtPlayer 没给这两个按钮写 tooltip，读屏和键盘用户需要名字
const FALLBACK_LABELS: Record<string, string> = {
  'art-control-playAndPause': '播放或暂停',
  'art-control-volume': '静音或取消静音',
};

function makeFocusable(root: HTMLElement) {
  const found = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  if (root.matches(FOCUSABLE_SELECTOR)) found.push(root);
  found.forEach((el) => {
    if (DISPLAY_ONLY.some((name) => el.classList.contains(name))) return;
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.getAttribute('aria-label')) {
      const label = Object.keys(FALLBACK_LABELS).find((name) =>
        el.classList.contains(name)
      );
      if (label) el.setAttribute('aria-label', FALLBACK_LABELS[label]);
    }
  });
}

export function enableArtKeyboardAccess(
  containers: Array<HTMLElement | null | undefined>
): () => void {
  const roots = containers.filter((el): el is HTMLElement => Boolean(el));
  // 设置面板在 DOM 里不挨着设置按钮，按 Tab 走不进去，需要主动把焦点送进去
  const panel = roots.find((el) => el.classList.contains('art-settings'));
  const settingToggle = () =>
    roots
      .map((el) => el.querySelector<HTMLElement>('.art-control-setting'))
      .find(Boolean) || null;
  const isVisible = (el: HTMLElement) =>
    el.offsetParent !== null || el.getClientRects().length > 0;
  const focusFirstSettingItem = () => {
    const first = Array.from(
      panel?.querySelectorAll<HTMLElement>('.art-setting-item') || []
    ).find(isVisible);
    first?.focus();
    return Boolean(first);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.key === 'Escape' && panel && target && panel.contains(target)) {
      // Esc 关闭设置面板，焦点回到设置按钮
      event.preventDefault();
      event.stopPropagation();
      const toggle = settingToggle();
      toggle?.click();
      toggle?.focus();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const control = target?.closest<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!control || control !== target) return;
    // 拦下空格，避免 ArtPlayer 全局快捷键把它当成“播放/暂停”
    event.preventDefault();
    event.stopPropagation();
    control.click();
    const openedSettings = control.classList.contains('art-control-setting');
    const insidePanel = Boolean(panel?.contains(control));
    if (openedSettings || insidePanel) {
      // 打开设置或进入子菜单后，面板会重新渲染，焦点放到当前第一项
      // （用 setTimeout 而不是 rAF：页面在后台时 rAF 不执行）
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const focusLost =
          !active || !panel?.contains(active) || !isVisible(active);
        if (openedSettings || focusLost) {
          // 面板还开着就停在当前层第一项；选完关掉了就回到设置按钮
          if (!focusFirstSettingItem()) settingToggle()?.focus();
        }
      }, 0);
    }
  };

  const observer =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) makeFocusable(node);
            });
          });
        });

  roots.forEach((root) => {
    makeFocusable(root);
    root.addEventListener('keydown', onKeyDown);
    observer?.observe(root, { childList: true, subtree: true });
  });

  return () => {
    observer?.disconnect();
    roots.forEach((root) => root.removeEventListener('keydown', onKeyDown));
  };
}
