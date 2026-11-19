// 结构检查的范围：本项目自己做的部分（站点外壳、发现、片库、房间、播放页和它们共用的东西）。
// 上游页面（漫画、小说、音乐、直播、电视、管理后台……）暂不纳入，见 docs/STANDARD.md “范围”。

/** 核心样式：块名归属、令牌、z-index、像素宽度媒体查询 */
export const CORE_CSS = [
  'src/styles/',
  'src/features/',
  'src/components/mini-player/',
  'src/components/detail/',
];

/** 核心代码：整文件 eslint-disable、写死的 z-index、文件行数 */
export const CORE_CODE = [
  'src/features/',
  'src/components/catalog/',
  'src/components/mini-player/',
  'src/components/shell/',
  'src/components/detail/',
  'src/components/feedback/',
  'src/components/VideoCard.tsx',
  'src/components/BannerCarousel.tsx',
  'src/components/ContinueWatching.tsx',
  'src/app/page.tsx',
  'src/app/douban/',
  'src/app/play/',
  'src/app/watch-room/',
];

/** 上游页面专用的样式，放在 styles/ 里但不属于核心 */
const EXCLUDED = ['src/styles/media.css'];

export function inScope(file, prefixes) {
  if (EXCLUDED.includes(file)) return false;
  return prefixes.some((prefix) =>
    prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix
  );
}
