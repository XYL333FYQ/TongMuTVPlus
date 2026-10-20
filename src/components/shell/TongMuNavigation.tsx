'use client';

import { motion } from 'framer-motion';
import {
  Blend,
  BookMarked,
  BookOpen,
  Clapperboard,
  Compass,
  Container,
  Download,
  Film,
  Globe,
  Library,
  Link as LinkIcon,
  ListVideo,
  MessageSquarePlus,
  Music2,
  Search,
  Star,
  Tv,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import ThemeSettings from '@/components/account/ThemeSettings';
import VisualPreferenceControls from '@/components/account/VisualPreferenceControls';
import { useShellReducedMotion } from '@/components/shell/ShellMotionProvider';

export function pageTitleForPath(path: string) {
  const names: Record<string, string> = {
    '/': '发现',
    '/douban': '片库',
    '/watch-room': '房间',
    '/search': '搜索',
    '/my': '我的',
    '/play': '播放',
    '/live': '电视直播',
    '/web-live': '网络直播',
    '/music': '音乐',
    '/manga': '漫画',
    '/books': '电子书',
    '/duanju': '短剧',
    '/private-library': '私人影库',
    '/movie-request': '求片',
    '/advanced-recommendation': '高级推荐',
    '/source-search': '源站寻片',
    '/about': '关于',
  };
  return names[path] || names['/' + path.split('/')[1]] || 'TongMuTV Plus';
}

export function DesktopNavigation({ current }: { current: string }) {
  const reduced = useShellReducedMotion();
  return (
    <nav className='tm-primary-nav tm-glass' aria-label='主导航'>
      {primaryNavigation.slice(0, 3).map((item) => {
        const active = isPrimaryNavigationActive(item.href, current);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className='tm-primary-nav-item tm-press'
            data-active={active}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                className='tm-primary-nav-selection'
                layoutId={reduced ? undefined : 'primary-selection'}
                transition={{
                  duration: reduced ? 0 : 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                aria-hidden='true'
              />
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const primaryNavigation = [
  { icon: Compass, label: '发现', href: '/' },
  { icon: Library, label: '片库', href: '/douban?type=movie' },
  { icon: Users, label: '房间', href: '/watch-room' },
  { icon: Search, label: '搜索', href: '/search' },
  { icon: UserRound, label: '我的', href: '/my' },
];

export function isPrimaryNavigationActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href.startsWith('/douban'))
    return pathname === '/douban' || pathname === '/source-search';
  return pathname === href || pathname.startsWith(href + '/');
}

export function MoreMenu({
  onNavigate,
  label = '更多',
}: { onNavigate?: () => void; label?: string } = {}) {
  const [runtime, setRuntime] = useState<Record<string, unknown>>({});
  const [canManageDownloads, setCanManageDownloads] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    setRuntime(window.RUNTIME_CONFIG || {});
    const role = getAuthInfoFromBrowserCookie()?.role;
    setCanManageDownloads(role === 'owner' || role === 'admin');
  }, []);

  const entries = [
    {
      icon: LinkIcon,
      label: '打开直链',
      description: '输入可直接播放的链接',
      href: '/?open=directplay',
      enabled: true,
    },
    {
      icon: Film,
      label: '电影',
      description: '发现电影与片源',
      href: '/douban?type=movie',
      enabled: true,
    },
    {
      icon: Tv,
      label: '剧集',
      description: '接着看下一集',
      href: '/douban?type=tv',
      enabled: true,
    },
    {
      icon: Clapperboard,
      label: '动漫',
      description: '更多值得看的故事',
      href: '/douban?type=anime',
      enabled: true,
    },
    {
      icon: Clapperboard,
      label: '综艺',
      description: '轻松看一会儿',
      href: '/douban?type=show',
      enabled: true,
    },
    {
      icon: Tv,
      label: '电视直播',
      description: '频道与节目单',
      href: '/live',
      enabled: !!runtime.LIVE_ENABLED,
    },
    {
      icon: Globe,
      label: '网络直播',
      description: '已配置的直播频道',
      href: '/web-live',
      enabled: !!runtime.WEB_LIVE_ENABLED,
    },
    {
      icon: Music2,
      label: '音乐',
      description: '歌曲与歌单',
      href: '/music',
      enabled: !!runtime.MUSIC_ENABLED,
    },
    {
      icon: BookOpen,
      label: '漫画',
      description: '漫画书架与阅读记录',
      href: '/manga',
      enabled: !!runtime.SUWAYOMI_ENABLED,
    },
    {
      icon: BookMarked,
      label: '电子书',
      description: '书架、阅读与听书',
      href: '/books',
      enabled: !!runtime.BOOKS_ENABLED,
    },
    {
      icon: Container,
      label: '私人影库',
      description: '连接自己的媒体收藏',
      href: '/private-library',
      enabled: !!runtime.PRIVATE_LIBRARY_ENABLED,
    },
    {
      icon: Blend,
      label: '高级推荐',
      description: '寻找更多合口味的作品',
      href: '/advanced-recommendation',
      enabled: !!runtime.ADVANCED_RECOMMENDATION_ENABLED,
    },
    {
      icon: ListVideo,
      label: '源站寻片',
      description: '浏览已经接入的内容来源',
      href: '/source-search',
      enabled: runtime.ENABLE_SOURCE_SEARCH !== false,
    },
    {
      icon: Clapperboard,
      label: '短剧',
      description: '轻松发现短篇故事',
      href: '/duanju',
      enabled: true,
    },
    {
      icon: Tv,
      label: '电视大屏',
      description: '使用遥控器浏览',
      href: '/tv',
      enabled: runtime.ENABLE_TV_MODE !== false,
    },
    {
      icon: Star,
      label: '自定义分类',
      description: '站点配置的精选分类',
      href: '/douban?type=custom',
      enabled:
        Array.isArray(runtime.CUSTOM_CATEGORIES) &&
        runtime.CUSTOM_CATEGORIES.length > 0,
    },
    {
      icon: MessageSquarePlus,
      label: '求片',
      description: '告诉站长你想看的作品',
      href: '/movie-request',
      enabled: runtime.ENABLE_MOVIE_REQUEST === true,
    },
    {
      icon: Download,
      label: '离线下载',
      description: '管理服务器上的下载任务',
      href: '/my?panel=downloads',
      enabled: runtime.ENABLE_OFFLINE_DOWNLOAD === true && canManageDownloads,
    },
  ].filter((entry) => entry.enabled);

  return (
    <>
      <button
        className='tm-more-trigger tm-press'
        onClick={() => dialogRef.current?.showModal()}
        aria-label={label}
        aria-haspopup='dialog'
      >
        <Compass size={20} strokeWidth={1.6} />
        <span>{label}</span>
      </button>
      <dialog
        ref={dialogRef}
        className='tm-explore-dialog'
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className='tm-explore-content'>
          <div className='tm-explore-heading'>
            <div>
              <h2 id={titleId}>更多</h2>
            </div>
            <button
              className='tm-icon-button'
              aria-label='关闭更多'
              onClick={() => dialogRef.current?.close()}
            >
              <X size={22} />
            </button>
          </div>
          <div className='tm-explore-grid'>
            {entries.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                prefetch={false}
                className='tm-explore-card'
                onClick={() => {
                  dialogRef.current?.close();
                  onNavigate?.();
                }}
              >
                <entry.icon size={24} strokeWidth={1.4} />
                <span>
                  <strong>{entry.label}</strong>
                  <small>{entry.description}</small>
                </span>
              </Link>
            ))}
          </div>
          <ThemeSettings />
          <VisualPreferenceControls />
        </div>
      </dialog>
    </>
  );
}
