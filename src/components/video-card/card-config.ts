/*
 * 影片卡片在不同页面上显示哪些东西（来源名、进度、播放按钮、收藏、评分……）。
 */

export type VideoCardFrom =
  | 'playrecord'
  | 'favorite'
  | 'search'
  | 'douban'
  | 'tmdb'
  | 'source-search';

export function cardConfig(
  from: VideoCardFrom,
  rate: string | undefined,
  isUpcoming: boolean | undefined
) {
  const configs = {
    playrecord: {
      showSourceName: true,
      showProgress: true,
      showPlayButton: true,
      showHeart: true,
      showCheckCircle: true,
      showDoubanLink: false,
      showRating: false,
      showYear: false,
    },
    favorite: {
      showSourceName: true,
      showProgress: false,
      showPlayButton: true,
      showHeart: true,
      showCheckCircle: false,
      showDoubanLink: false,
      showRating: false,
      showYear: false,
    },
    search: {
      showSourceName: true,
      showProgress: false,
      showPlayButton: true,
      showHeart: true, // 移动端菜单中需要显示收藏选项
      showCheckCircle: false,
      showDoubanLink: true, // 移动端菜单中显示豆瓣链接
      showRating: !!rate,
      showYear: true,
    },
    douban: {
      showSourceName: false,
      showProgress: false,
      showPlayButton: !isUpcoming, // 即将上映不显示播放按钮
      showHeart: false,
      showCheckCircle: false,
      showDoubanLink: false,
      showRating: !!rate,
      showYear: false,
    },
    tmdb: {
      showSourceName: false,
      showProgress: false,
      showPlayButton: !isUpcoming, // 即将上映不显示播放按钮
      showHeart: false,
      showCheckCircle: false,
      showDoubanLink: false,
      showRating: !!rate,
      showYear: false,
    },
    'source-search': {
      showSourceName: false,
      showProgress: false,
      showPlayButton: true,
      showHeart: true,
      showCheckCircle: false,
      showDoubanLink: true,
      showRating: !!rate,
      showYear: true,
    },
  };
  return configs[from] || configs.search;
}

export type VideoCardConfig = ReturnType<typeof cardConfig>;
