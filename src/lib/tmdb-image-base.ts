// TMDB 图片地址默认值（站点级）
// 该模块保持轻量、无 Node/DB 依赖，可被客户端与服务端共同引用。
// 服务端在加载站点配置后，通过 setServerTmdbImageBaseUrl 同步该值，
// 使 getTMDBImageUrl 等同步函数能在无用户 localStorage 的环境下拿到站点默认图片地址。
const DEFAULT_TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org';

let serverTmdbImageBaseUrl = DEFAULT_TMDB_IMAGE_BASE_URL;

export function setServerTmdbImageBaseUrl(url?: string) {
  serverTmdbImageBaseUrl = url || DEFAULT_TMDB_IMAGE_BASE_URL;
}

export function getServerTmdbImageBaseUrl(): string {
  return serverTmdbImageBaseUrl;
}

export function getDefaultTmdbImageBaseUrl(): string {
  return DEFAULT_TMDB_IMAGE_BASE_URL;
}

/**
 * 解析当前应使用的 TMDB 图片 Base URL。
 * 优先级：用户本地设置（localStorage.tmdbImageBaseUrl）> 站点默认（RUNTIME_CONFIG.TMDB_IMAGE_BASE_URL / 服务端同步值）> 官方默认地址。
 */
export function getTmdbImageBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('tmdbImageBaseUrl');
    if (local) return local;

    const runtimeBaseUrl = (window as any).RUNTIME_CONFIG?.TMDB_IMAGE_BASE_URL;
    if (typeof runtimeBaseUrl === 'string' && runtimeBaseUrl) {
      return runtimeBaseUrl;
    }
    return DEFAULT_TMDB_IMAGE_BASE_URL;
  }

  return serverTmdbImageBaseUrl || DEFAULT_TMDB_IMAGE_BASE_URL;
}

/**
 * 获取 TMDB 图片完整 URL
 * @param path - 图片路径
 * @param size - 图片尺寸，默认 w500
 * @returns 完整的图片 URL
 */
export function getTMDBImageUrl(path: string | null, size = 'w500'): string {
  if (!path) return '';

  // 如果已经是完整的 URL (http:// 或 https://),直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const baseUrl = getTmdbImageBaseUrl();
  return `${baseUrl}/t/p/${size}${path}`;
}

/**
 * TMDB 类型映射（中文）
 */
export const TMDB_GENRES: Record<number, string> = {
  // 电影类型
  28: '动作',
  12: '冒险',
  16: '动画',
  35: '喜剧',
  80: '犯罪',
  99: '纪录',
  18: '剧情',
  10751: '家庭',
  14: '奇幻',
  36: '历史',
  27: '恐怖',
  10402: '音乐',
  9648: '悬疑',
  10749: '爱情',
  878: '科幻',
  10770: '电视电影',
  53: '惊悚',
  10752: '战争',
  37: '西部',
  // 电视剧类型
  10759: '动作冒险',
  10762: '儿童',
  10763: '新闻',
  10764: '真人秀',
  10765: '科幻奇幻',
  10766: '肥皂剧',
  10767: '脱口秀',
  10768: '战争政治',
};

/**
 * 根据类型ID获取类型名称列表
 * @param genreIds - 类型ID数组
 * @param limit - 最多返回几个类型，默认2个
 * @returns 类型名称数组
 */
export function getGenreNames(genreIds: number[] = [], limit = 2): string[] {
  return genreIds
    .map((id) => TMDB_GENRES[id])
    .filter(Boolean)
    .slice(0, limit);
}
