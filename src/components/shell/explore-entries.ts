/*
 * 顶栏“更多”里的扩展入口：每个入口站点开没开、本账号有没有权限、没登录时怎么提示。
 * 入口表随站点配置（window.RUNTIME_CONFIG）变；菜单本身在 TongMuNavigation 的 MoreMenu。
 */

import {
  Blend,
  BookMarked,
  BookOpen,
  Container,
  Globe,
  Link as LinkIcon,
  ListVideo,
  MessageSquarePlus,
  MonitorPlay,
  Music2,
  Tv,
} from 'lucide-react';

export type ExploreEntryState =
  | 'open'
  | 'site-locked'
  | 'login'
  | 'no-permission';

export interface ExploreEntry {
  // 对应的功能权限 key；有它才能在提示里「向站长申请」
  permission?: string;
  icon: typeof Tv;
  label: string;
  description: string;
  href: string;
  siteEnabled: boolean;
  userEnabled: boolean;
}

export interface ExploreNotice {
  title: string;
  message: string;
  loginHref?: string;
  requestHref?: string;
  // 站长/管理员碰到“未开放”时，直接去管理面板配置，不用向自己申请
  adminHref?: string;
}

export function resolveEntryState(
  siteEnabled: boolean,
  userEnabled: boolean,
  loggedIn: boolean
): ExploreEntryState {
  if (!siteEnabled) return 'site-locked';
  if (!loggedIn) return 'login';
  if (!userEnabled) return 'no-permission';
  return 'open';
}

export const ENTRY_BADGE: Record<Exclude<ExploreEntryState, 'open'>, string> = {
  'site-locked': '未开放',
  login: '登录后可用',
  'no-permission': '未授权',
};

export function buildNotice(state: ExploreEntryState): ExploreNotice {
  if (state === 'login') {
    return {
      title: '需要登录',
      message: '登录后即可使用此功能。',
    };
  }
  if (state === 'no-permission') {
    return {
      title: '暂无使用权限',
      message: '当前账号没有使用权限。',
    };
  }
  return {
    title: '功能未开放',
    message: '站长暂未开放此功能。',
  };
}

export interface ExploreGroup {
  title: string;
  gridClass: string;
  entries: ExploreEntry[];
}

/** 入口分组：站点开关、本账号开关都从运行时配置里读 */
export function buildExploreGroups(
  runtime: Record<string, unknown>
): ExploreGroup[] {
  const flag = (key: string) => runtime[key] === true;

  const createEntry = (
    icon: ExploreEntry['icon'],
    entry: Omit<ExploreEntry, 'icon' | 'siteEnabled' | 'userEnabled'> & {
      site: string;
      user: string;
      permission?: string;
    }
  ): ExploreEntry => ({
    icon,
    permission: entry.permission,
    label: entry.label,
    description: entry.description,
    href: entry.href,
    siteEnabled: flag(entry.site),
    userEnabled: flag(entry.user),
  });

  return [
    {
      title: '扩展内容',
      gridClass: 'tm-explore-grid',
      entries: [
        createEntry(Tv, {
          label: '电视直播',
          description: '频道与节目单',
          href: '/live',
          site: 'SITE_LIVE_ENABLED',
          user: 'LIVE_ENABLED',
          permission: 'live',
        }),
        createEntry(Globe, {
          label: '网络直播',
          description: '已配置的直播频道',
          href: '/web-live',
          site: 'SITE_WEB_LIVE_ENABLED',
          user: 'WEB_LIVE_ENABLED',
          permission: 'web_live',
        }),
        createEntry(Music2, {
          label: '音乐',
          description: '歌曲与歌单',
          href: '/music',
          site: 'SITE_MUSIC_ENABLED',
          user: 'MUSIC_ENABLED',
          permission: 'music',
        }),
        createEntry(BookMarked, {
          label: '电子书',
          description: '书架、阅读与听书',
          href: '/books',
          site: 'SITE_BOOKS_ENABLED',
          user: 'BOOKS_ENABLED',
          permission: 'books',
        }),
        createEntry(BookOpen, {
          label: '漫画',
          description: '漫画书架与阅读记录',
          href: '/manga',
          site: 'SITE_MANGA_ENABLED',
          user: 'SUWAYOMI_ENABLED',
          permission: 'manga',
        }),
        createEntry(Container, {
          label: '私人影库',
          description: '连接自己的媒体收藏',
          href: '/private-library',
          site: 'SITE_PRIVATE_LIBRARY_ENABLED',
          user: 'PRIVATE_LIBRARY_ENABLED',
          permission: 'private_library',
        }),
      ],
    },
    {
      title: '影视辅助',
      gridClass: 'tm-explore-grid tm-explore-grid-2',
      entries: [
        {
          icon: ListVideo,
          label: '源站寻片',
          description: '浏览已经接入的内容来源',
          href: '/source-search',
          siteEnabled: runtime.ENABLE_SOURCE_SEARCH !== false,
          userEnabled: true,
        },
        createEntry(Blend, {
          label: '高级推荐',
          description: '寻找更多合口味的作品',
          href: '/advanced-recommendation',
          site: 'SITE_ADVANCED_RECOMMENDATION_ENABLED',
          user: 'ADVANCED_RECOMMENDATION_ENABLED',
          permission: 'advanced_recommendation',
        }),
      ],
    },
    {
      title: '工具与服务',
      gridClass: 'tm-explore-grid tm-explore-grid-2',
      entries: [
        {
          icon: LinkIcon,
          label: '打开直链',
          description: '输入可直接播放的链接',
          href: '/?open=directplay',
          siteEnabled: true,
          userEnabled: true,
        },
        createEntry(MessageSquarePlus, {
          label: '求片',
          description: '告诉站长你想看的作品',
          href: '/movie-request',
          site: 'SITE_MOVIE_REQUEST_ENABLED',
          user: 'ENABLE_MOVIE_REQUEST',
          permission: 'movie_request',
        }),
      ],
    },
    {
      title: '使用模式',
      gridClass: 'tm-explore-grid tm-explore-grid-1',
      entries: [
        {
          icon: MonitorPlay,
          label: '电视大屏',
          description: '使用遥控器浏览',
          href: '/tv',
          siteEnabled: runtime.SITE_TV_MODE_ENABLED === true,
          userEnabled: runtime.ENABLE_TV_MODE !== false,
        },
      ],
    },
  ];
}
