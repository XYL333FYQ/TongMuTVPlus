// 原材料探测器：公共零件登记表（docs/STANDARD.md）里每个零件对应一种“原材料”。
// 主人以外的文件直接用原材料，就是又做了一份同样的东西。结构检查按文件计数，走棘轮（只许减少）。
//
// 注释里的匹配也算：静态统计分不清注释和代码，宁可多记，旧账靠名单兜住。

export const DETECTORS = {
  portal: { pattern: /\bcreatePortal\s*\(/g, label: '直接 createPortal' },
  storage: {
    pattern:
      /\b(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem|clear)\s*\(/g,
    label: '直接读写浏览器存储',
  },
  screen: {
    pattern:
      /\bmatchMedia\s*\(|\binnerWidth\b|\binnerHeight\b|\bscreen\.(?:width|height)\b/g,
    label: '直接量屏幕尺寸',
  },
  player: {
    pattern: /\bnew\s+(?:Artplayer|Hls)\s*\(|\bflvjs\.createPlayer\s*\(/g,
    label: '直接创建播放器',
  },
  timeFormat: {
    pattern:
      /\b(?:function|const)\s+format\w*(?:Time|Duration|Clock|Seconds)\b/g,
    label: '自己写时间格式化',
  },
  toast: { pattern: /<Toast\b/g, label: '直接渲染 Toast' },
  spinner: {
    pattern: /\banimate-spin\b|\bLoader2\b/g,
    label: '自己画加载转圈',
  },
  emoji: {
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
    label: '用 emoji 当图标',
  },
  // 不属于哪个零件：行内跳过代码检查的注释（S8），全部 src 都统计
  eslintDisableInline: {
    pattern: /eslint-disable-(?:next-)?line\b/g,
    label: '行内跳过代码检查',
  },
};

// S5：!important 只许用在这几种场合——压 Artplayer 的内联样式、减弱动效、关闭玻璃效果、
// 主题切换动画。选择器或任一外层 @ 规则命中其一即可。
const ALLOWED_IMPORTANT =
  /data-tm-reduced-motion|prefers-reduced-motion|data-tm-no-blur|data-tm-theme-transition|\.art-|artplayer/;

export function isAllowedImportant(selector, atRules) {
  return [selector, ...atRules].some((text) => ALLOWED_IMPORTANT.test(text));
}

/** 统计一段文本里某种原材料出现的次数（先把 CRLF 统一成 LF） */
export function countMatches(text, id) {
  const detector = DETECTORS[id];
  if (!detector) throw new Error(`未知的探测器：${id}`);
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized.match(detector.pattern)?.length ?? 0;
}
