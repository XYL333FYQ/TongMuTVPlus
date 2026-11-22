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
};

/** 统计一段文本里某种原材料出现的次数（先把 CRLF 统一成 LF） */
export function countMatches(text, id) {
  const detector = DETECTORS[id];
  if (!detector) throw new Error(`未知的探测器：${id}`);
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized.match(detector.pattern)?.length ?? 0;
}
